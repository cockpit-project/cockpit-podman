#!/bin/sh
set -eux

# tests need cockpit's bots/ libraries and test infrastructure
cd $SOURCE
git init
make bots test/common

# only install a subset to save time/space
rm -f package-lock.json  # otherwise the command below installs *everything*, argh
npm install chrome-remote-interface sizzle

. /etc/os-release
export TEST_OS="${ID}-${VERSION_ID/./-}"
# HACK: upstream does not yet know about rawhide
if [ "$TEST_OS" = "fedora-34" ]; then
    export TEST_OS=fedora-33
fi

export TEST_AUDIT_NO_SELINUX=1

EXCLUDES=""

RC=0
test/common/run-tests --nondestructive --machine 127.0.0.1:22 --browser 127.0.0.1:9090 $EXCLUDES || RC=$?

echo $RC > "$LOGS/exitcode"
cp --verbose Test* "$LOGS" || true
# deliver test result via exitcode file
exit 0
