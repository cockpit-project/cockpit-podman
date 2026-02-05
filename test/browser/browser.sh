#!/bin/sh
# SPDX-License-Identifier: LGPL-2.1-or-later

set -eux
cd "${0%/*}/../.."

# HACK: ensure that critical components are up to date: https://github.com/psss/tmt/issues/682
if [ ! -e /sysroot/ostree ]; then
    dnf update -y podman crun conmon criu
fi

# if we run during cross-project testing against our main-builds COPR, then let that win
# even if Fedora has a newer revision
main_builds_repo="$(ls /etc/yum.repos.d/*cockpit*main-builds* 2>/dev/null || true)"
if [ -n "$main_builds_repo" ]; then
    echo 'priority=0' >> "$main_builds_repo"
    dnf distro-sync -y --repo 'copr*' cockpit-podman
fi

# Show critical package versions
rpm -q runc crun podman criu passt catatonit kernel-core selinux-policy cockpit-podman cockpit-bridge || true

# Show network information, for pasta debugging
ip address show
ip -4 route show
ip -6 route show

# allow test to set up things on the machine
mkdir -p /root/.ssh
curl https://raw.githubusercontent.com/cockpit-project/bots/main/machine/identity.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# HACK: unbreak subuid assignment for new users; see
# https://bugzilla.redhat.com/show_bug.cgi?id=2382662
# https://issues.redhat.com/browse/RHEL-103765
sed -i '/^SUB_.ID_COUNT/ s/\b0/65536/' /etc/login.defs

# create user account for logging in
if ! id admin 2>/dev/null; then
    useradd -c Administrator -G wheel admin
    echo admin:foobar | chpasswd
fi

# set root's password
echo root:foobar | chpasswd

# avoid sudo lecture during tests
su -c 'echo foobar | sudo --stdin whoami' - admin

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

CONTAINER="$(cat .cockpit-ci/container)"

# import the test CONTAINER image as a directory tree for nspawn
mkdir /var/tmp/tasks
podman export "$(podman create --name tasks-import $CONTAINER)" | tar -x -C /var/tmp/tasks
podman rm tasks-import
podman rmi $CONTAINER

# image setup, shared with upstream tests
sh -x test/vm.install
sh -x test/vm-ws-package.install

systemctl enable --now cockpit.socket

# HACK: https://issues.redhat.com/browse/RHEL-49567
if rpm -q selinux-policy | grep -q el10; then
    setenforce 0
fi

# Run tests in the cockpit tasks container, as unprivileged user
# Use nspawn to avoid the tests killing the tasks container itself
chown -R 1111:1111 "${TMT_TEST_DATA}" .

SYSTEMD_SECCOMP=0 systemd-nspawn \
    -D /var/tmp/tasks/ \
    --ephemeral \
    --user user \
    --setenv=TEST_AUDIT_NO_SELINUX="${TEST_AUDIT_NO_SELINUX:-}" \
    --bind="${TMT_TEST_DATA}":/logs --setenv=LOGS=/logs \
    --bind="$(pwd)":/source --setenv=SOURCE=/source \
    --bind-ro=/usr/lib/os-release:/run/host/usr/lib/os-release \
    sh /source/test/browser/run-test.sh "$@"
