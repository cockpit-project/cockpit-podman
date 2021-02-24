#!/bin/sh
set -eux

TESTS="$(realpath $(dirname "$0"))"
if [ -d source ]; then
    # path for standard-test-source
    SOURCE="$(pwd)/source"
else
    SOURCE="$(realpath $TESTS/../..)"
fi
LOGS="$(pwd)/logs"
mkdir -p "$LOGS"
chmod a+w "$LOGS"

# install browser; on RHEL, use chromium from epel
# HACK: chromium-headless ought to be enough, but version 88 has a crash: https://bugs.chromium.org/p/chromium/issues/detail?id=1170634
if ! rpm -q chromium; then
    if grep -q 'ID=.*rhel' /etc/os-release; then
        dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
        dnf config-manager --enable epel
    fi
    dnf install -y chromium
fi

# HACK: systemd kills the services after 90s
# See https://github.com/containers/podman/issues/8751
sed -i 's/Type=notify/Type=exec/' /usr/lib/systemd/system/podman.service
sed -i 's/Type=notify/Type=exec/' /usr/lib/systemd/user/podman.service

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
    curl https://raw.githubusercontent.com/cockpit-project/bots/master/machine/identity.pub  >> /root/.ssh/authorized_keys
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
su - -c "env SOURCE=$SOURCE LOGS=$LOGS $TESTS/run-test.sh" runtest

RC=$(cat $LOGS/exitcode)
exit ${RC:-1}
