#!/bin/sh
set -eux

TESTS="$(realpath $(dirname "$0"))"
if [ -d source ]; then
    # path for standard-test-source
    SOURCE="$(pwd)/source"
else
    SOURCE="$(realpath $TESTS/../..)"
fi
# workaround until tmt-1.10 is out with https://github.com/psss/tmt/pull/1004
if [ -n "${TMT_TREE:-}" ]; then
    LOGS="$TMT_TREE/../execute/data/test/browser/logs"
else
    LOGS="$(pwd)/logs"
fi
mkdir -p "$LOGS"
chmod a+w "$LOGS"

# install firefox (available everywhere in Fedora and RHEL)
# we don't need the H.264 codec, and it is sometimes not available (rhbz#2005760)
dnf install --disablerepo=fedora-cisco-openh264 -y --setopt=install_weak_deps=False firefox

# HACK: ensure that critical components are up to date: https://github.com/psss/tmt/issues/682
dnf update -y podman crun

# Show critical package versions
rpm -q runc crun podman criu kernel-core || true

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
podman pull quay.io/libpod/busybox
podman pull quay.io/libpod/alpine
podman pull quay.io/cockpit/registry:2

# copy images for user podman tests; podman insists on user session
loginctl enable-linger $(id -u admin)
for img in quay.io/libpod/busybox quay.io/libpod/alpine quay.io/cockpit/registry:2; do
    podman save  $img | sudo -i -u admin podman load
done
loginctl disable-linger $(id -u admin)

systemctl enable --now cockpit.socket podman.socket

# Run tests as unprivileged user
su - -c "env TEST_BROWSER=firefox SOURCE=$SOURCE LOGS=$LOGS $TESTS/run-test.sh" runtest

RC=$(cat $LOGS/exitcode)
exit ${RC:-1}
