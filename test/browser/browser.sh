#!/bin/sh
set -eux

# test plan name, passed on to run-test.sh
PLAN="$1"

export TEST_BROWSER=${TEST_BROWSER:-firefox}

TESTS="$(realpath $(dirname "$0"))"
export SOURCE="$(realpath $TESTS/../..)"

# https://tmt.readthedocs.io/en/stable/overview.html#variables
export LOGS="${TMT_TEST_DATA:-$(pwd)/logs}"
mkdir -p "$LOGS"
chmod a+w "$LOGS"

# install firefox (available everywhere in Fedora and RHEL)
# we don't need the H.264 codec, and it is sometimes not available (rhbz#2005760)
dnf install --disablerepo=fedora-cisco-openh264 -y --setopt=install_weak_deps=False firefox

# nodejs 10 is too old for current Cockpit test API
if grep -q platform:el8 /etc/os-release; then
    dnf module switch-to -y nodejs:16
fi

# HACK: ensure that critical components are up to date: https://github.com/psss/tmt/issues/682
dnf update -y podman crun conmon criu

# HACK: TF prioritizes Fedora tag repo over all others, in particular our daily COPR for revdep tests
# This is bad -- let the highest version win instead!
# https://gitlab.com/testing-farm/infrastructure/-/blob/testing-farm/ranch/public/citool-config/guest-setup/pre-artifact-installation/templates/tag.repo.j2?ref_type=heads
for f in $(grep -l -r 'testing-farm-tag-repository' /etc/yum.repos.d); do
    sed -i '/priority/d' "$f"
done
dnf update -y cockpit-podman

# Show critical package versions
rpm -q runc crun podman criu kernel-core selinux-policy cockpit-podman cockpit-bridge || true

# create user account for logging in
if ! id admin 2>/dev/null; then
    useradd -c Administrator -G wheel admin
    echo admin:foobar | chpasswd
fi

# set root's password
echo root:foobar | chpasswd

# avoid sudo lecture during tests
su -c 'echo foobar | sudo --stdin whoami' - admin

# create user account for running the test
if ! id runtest 2>/dev/null; then
    useradd -c 'Test runner' runtest
    # allow test to set up things on the machine
    mkdir -p /root/.ssh
    curl https://raw.githubusercontent.com/cockpit-project/bots/main/machine/identity.pub  >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
fi
chown -R runtest "$SOURCE"

# disable core dumps, we rather investigate them upstream where test VMs are accessible
echo core > /proc/sys/kernel/core_pattern

# grab a few images to play with; tests run offline, so they cannot download images
podman rmi --all

# set up our expected images, in the same way that we do for upstream CI
# this sometimes runs into network issues, so retry a few times
for retry in $(seq 5); do
    if curl https://raw.githubusercontent.com/cockpit-project/bots/main/images/scripts/lib/podman-images.setup | sh -eux; then
        break
    fi
    sleep $((5 * retry * retry))
done

# copy images for user podman tests; podman insists on user session
loginctl enable-linger $(id -u admin)
for img in localhost/test-alpine localhost/test-busybox localhost/test-registry; do
    podman save  $img | sudo -i -u admin podman load
done
loginctl disable-linger $(id -u admin)

systemctl enable --now cockpit.socket podman.socket

# Run tests as unprivileged user
# once we drop support for RHEL 8, use this:
# runuser -u runtest --whitelist-environment=TEST_BROWSER,TEST_ALLOW_JOURNAL_MESSAGES,TEST_AUDIT_NO_SELINUX,SOURCE,LOGS $TESTS/run-test.sh $PLAN
runuser -u runtest --preserve-environment env USER=runtest HOME=$(getent passwd runtest | cut -f6 -d:) $TESTS/run-test.sh $PLAN

RC=$(cat $LOGS/exitcode)
exit ${RC:-1}
