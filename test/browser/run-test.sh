#!/bin/sh
set -eux

PLAN="$1"

# tests need cockpit's bots/ libraries and test infrastructure
cd $SOURCE
rm -f bots  # common local case: existing bots symlink
make bots test/common

if [ -e .git ]; then
    tools/node-modules checkout
    # disable detection of affected tests; testing takes too long as there is no parallelization
    mv .git dot-git
else
    # upstream tarballs ship test dependencies; print version for debugging
    grep '"version"' node_modules/chrome-remote-interface/package.json
fi

. /etc/os-release
export TEST_OS="${ID}-${VERSION_ID/./-}"
export TEST_AUDIT_NO_SELINUX=1

if [ "${TEST_OS#centos-}" != "$TEST_OS" ]; then
    TEST_OS="${TEST_OS}-stream"
fi

# select subset of tests according to plan
TESTS="$(test/common/run-tests -l)"
case "$PLAN" in
    system) TESTS="$(echo "$TESTS" | grep 'System$')" ;;
    user) TESTS="$(echo "$TESTS" | grep 'User$')" ;;
    other) TESTS="$(echo "$TESTS" | grep -vE '(System|User)$')" ;;
    *) echo "Unknown test plan: $PLAN" >&2; exit 1 ;;
esac

EXCLUDES=""

RC=0
test/common/run-tests --nondestructive --machine 127.0.0.1:22 --browser 127.0.0.1:9090 $TESTS $EXCLUDES || RC=$?

echo $RC > "$LOGS/exitcode"
cp --verbose Test* "$LOGS" || true
# deliver test result via exitcode file
exit 0
