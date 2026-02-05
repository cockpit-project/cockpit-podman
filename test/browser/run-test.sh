# SPDX-License-Identifier: LGPL-2.1-or-later
set -eux

PLAN="$1"

cd "${SOURCE}"

# tests need cockpit's bots/ libraries and test infrastructure
rm -f bots  # common local case: existing bots symlink
make bots test/common

if [ -e .git ]; then
    tools/node-modules checkout
    # disable detection of affected tests; testing takes too long as there is no parallelization
    mv .git dot-git
fi

. /run/host/usr/lib/os-release
export TEST_OS="${ID}-${VERSION_ID/./-}"

if [ -e /sysroot/ostree ]; then
    TEST_OS="${TEST_OS}-bootc"
elif [ "$TEST_OS" = "centos-9" ]; then
    TEST_OS="${TEST_OS}-stream"
fi

# Chromium sometimes gets OOM killed on testing farm
export TEST_BROWSER=firefox

# select subset of tests according to plan
TESTS="$(test/common/run-tests -l)"
case "$PLAN" in
    system) TESTS="$(echo "$TESTS" | grep 'System$')" ;;
    user) TESTS="$(echo "$TESTS" | grep 'User$')" ;;
    other) TESTS="$(echo "$TESTS" | grep -vE '(System|User)$')" ;;
    *) echo "Unknown test plan: $PLAN" >&2; exit 1 ;;
esac

EXCLUDES=""

# make it easy to check in logs
echo "TEST_ALLOW_JOURNAL_MESSAGES: ${TEST_ALLOW_JOURNAL_MESSAGES:-}"
echo "TEST_AUDIT_NO_SELINUX: ${TEST_AUDIT_NO_SELINUX:-}"

RC=0
./test/common/run-tests \
    --nondestructive \
    --machine localhost:22 \
    --browser localhost:9090 \
    $TESTS \
    $EXCLUDES \
|| RC=$?
cp --verbose Test* "$LOGS" || true
exit $RC
