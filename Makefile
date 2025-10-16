# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := cockpit-$(PACKAGE_NAME)
VERSION := $(shell T=$$(git describe 2>/dev/null) || T=1; echo $$T | tr '-' '.')
ifeq ($(TEST_OS),)
TEST_OS = fedora-42
endif
export TEST_OS
TARFILE=$(RPM_NAME)-$(VERSION).tar.xz
NODE_CACHE=$(RPM_NAME)-node-$(VERSION).tar.xz
SPEC=$(RPM_NAME).spec
PREFIX ?= /usr/local
APPSTREAMFILE=org.cockpit_project.$(PACKAGE_NAME).metainfo.xml
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
# stamp file to check for node_modules/
NODE_MODULES_TEST=package-lock.json
# build.js ran in non-watch mode
DIST_TEST=runtime-npm-modules.txt
# one example file in pkg/lib to check if it was already checked out
COCKPIT_REPO_STAMP=pkg/lib/cockpit-po-plugin.js
# common arguments for tar, mostly to make the generated tarballs reproducible
TAR_ARGS = --sort=name --mtime "@$(shell git show --no-patch --format='%at')" --mode=go=rX,u+rw,a-s --numeric-owner --owner=0 --group=0

VM_CUSTOMIZE_FLAGS =

ifeq ("$(TEST_SCENARIO)","ws-container")
VM_CUSTOMIZE_FLAGS += --upload $(TARFILE):/var/tmp/ --script $(CURDIR)/test/vm-beiboot.install
else ifneq (,$(or $(findstring coreos,$(TEST_OS)),$(findstring bootc,$(TEST_OS))))
# HACK for ostree images: skip the rpm build/install
VM_CUSTOMIZE_FLAGS += --run-command 'mkdir -p /usr/local/share/cockpit' --upload dist/:/usr/local/share/cockpit/podman
else
VM_CUSTOMIZE_FLAGS += --upload $(NODE_CACHE):/var/tmp --build $(TARFILE) --script $(CURDIR)/test/vm-ws-package.install
endif

# the following scenarios need network access
ifeq ("$(TEST_SCENARIO)","updates-testing")
VM_CUSTOMIZE_FLAGS += --run-command 'dnf -y update --setopt=install_weak_deps=False --enablerepo=updates-testing >&2'
else ifneq ($(TEST_COPR),)
VM_CUSTOMIZE_FLAGS += --run-command 'dnf -y copr enable $(TEST_COPR) >&2; dnf -y update --repo "copr*" >&2'
else
# default scenario does not install packages
VM_CUSTOMIZE_FLAGS += --no-network
endif

ifeq ($(TEST_COVERAGE),yes)
RUN_TESTS_OPTIONS+=--coverage
NODE_ENV=development
endif

all: $(DIST_TEST)

# checkout common files from Cockpit repository required to build this project;
# this has no API stability guarantee, so check out a stable tag when you start
# a new project, use the latest release, and update it from time to time
COCKPIT_REPO_FILES = \
	pkg/lib \
	test/common \
	tools/node-modules \
	$(NULL)

COCKPIT_REPO_URL = https://github.com/cockpit-project/cockpit.git
COCKPIT_REPO_COMMIT = c137401a2b5fd8ba2088242b9ddc2f35fbb18337 # 351

$(COCKPIT_REPO_FILES): $(COCKPIT_REPO_STAMP)
COCKPIT_REPO_TREE = '$(strip $(COCKPIT_REPO_COMMIT))^{tree}'
$(COCKPIT_REPO_STAMP): Makefile
	@git rev-list --quiet --objects $(COCKPIT_REPO_TREE) -- 2>/dev/null || \
	    git fetch --no-tags --no-write-fetch-head --depth=1 $(COCKPIT_REPO_URL) $(COCKPIT_REPO_COMMIT)
	git archive $(COCKPIT_REPO_TREE) -- $(COCKPIT_REPO_FILES) | tar x

#
# i18n
#

LINGUAS=$(basename $(notdir $(wildcard po/*.po)))

po/$(PACKAGE_NAME).js.pot:
	xgettext --default-domain=$(PACKAGE_NAME) --output=- --language=C --keyword= \
		--keyword=_:1,1t --keyword=_:1c,2,2t --keyword=C_:1c,2 \
		--keyword=N_ --keyword=NC_:1c,2 \
		--keyword=gettext:1,1t --keyword=gettext:1c,2,2t \
		--keyword=ngettext:1,2,3t --keyword=ngettext:1c,2,3,4t \
		--keyword=gettextCatalog.getString:1,3c --keyword=gettextCatalog.getPlural:2,3,4c \
		--from-code=UTF-8 $$(find src/ -name '*.[jt]s' -o -name '*.[jt]sx') | \
		sed '/^#/ s/, c-format//' > $@

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	pkg/lib/html2po -o $@ $$(find src -name '*.html')

po/$(PACKAGE_NAME).manifest.pot: $(COCKPIT_REPO_STAMP)
	pkg/lib/manifest2po -o $@ src/manifest.json

po/$(PACKAGE_NAME).metainfo.pot: $(APPSTREAMFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ $<

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot po/$(PACKAGE_NAME).metainfo.pot
	msgcat --sort-output --output-file=$@ $^

po/LINGUAS:
	echo $(LINGUAS) | tr ' ' '\n' > $@

#
# Build/Install/dist
#
$(SPEC): packaging/$(SPEC).in $(DIST_TEST)
	provides=$$(awk '{print "Provides: bundled(npm(" $$1 ")) = " $$2}' runtime-npm-modules.txt); \
	awk -v p="$$provides" '{gsub(/%{VERSION}/, "$(VERSION)"); gsub(/%{NPM_PROVIDES}/, p)}1' $< > $@

packaging/arch/PKGBUILD: packaging/arch/PKGBUILD.in
	sed 's/VERSION/$(VERSION)/; s/SOURCE/$(TARFILE)/' $< > $@

packaging/debian/changelog: packaging/debian/changelog.in
	sed 's/VERSION/$(VERSION)/' $< > $@

$(DIST_TEST): $(COCKPIT_REPO_STAMP) $(shell find src/ -type f) package.json build.js
	$(MAKE) package-lock.json && NODE_ENV=$(NODE_ENV) ./build.js

watch: $(NODE_MODULES_TEST)
	NODE_ENV=$(NODE_ENV) ./build.js -w

clean:
	rm -rf dist/
	rm -f $(SPEC) packaging/arch/PKGBUILD packaging/debian/changelog
	rm -f po/LINGUAS
	rm -f metafile.json runtime-npm-modules.txt

install: $(DIST_TEST) po/LINGUAS
	mkdir -p $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)$(PREFIX)/share/metainfo/
	msgfmt --xml -d po \
		--template $(APPSTREAMFILE) \
		-o $(DESTDIR)$(PREFIX)/share/metainfo/$(APPSTREAMFILE)

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(DIST_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -s `pwd`/dist ~/.local/share/cockpit/$(PACKAGE_NAME)

# assumes that there was symlink set up using the above devel-install target,
# and removes it
devel-uninstall:
	rm -f ~/.local/share/cockpit/$(PACKAGE_NAME)

print-version:
	@echo "$(VERSION)"

# required for running integration tests
TEST_NPMS = \
       node_modules/sizzle \
       $(NULL)

dist: $(TARFILE)
	@ls -1 $(TARFILE)

# when building a distribution tarball, call bundler with a 'production' environment by default
# we don't ship most node_modules for license and compactness reasons, only the ones necessary for running tests
# we ship a pre-built dist/ (so it's not necessary) and ship package-lock.json (so that node_modules/ can be reconstructed if necessary)
$(TARFILE): export NODE_ENV ?= production
$(TARFILE): $(DIST_TEST) $(SPEC) packaging/arch/PKGBUILD packaging/debian/changelog
	if type appstream-util >/dev/null 2>&1; then appstream-util validate-relax --nonet *.metainfo.xml; fi
	tar --xz $(TAR_ARGS) -cf $(TARFILE) --transform 's,^,$(RPM_NAME)/,' \
		--exclude '*.in' --exclude test/reference \
		$$(git ls-files | grep -v node_modules) \
		$(COCKPIT_REPO_FILES) $(NODE_MODULES_TEST) $(DIST_TEST) $(SPEC) $(TEST_NPMS) \
		packaging/arch/PKGBUILD packaging/debian/changelog dist/

$(NODE_CACHE): $(NODE_MODULES_TEST)
	tools/node-modules runtime-tar $(NODE_CACHE)

node-cache: $(NODE_CACHE)

# convenience target for developers
rpm: $(TARFILE)
	rpmbuild -tb --define "_topdir $(CURDIR)/tmp/rpmbuild" $(TARFILE)
	find tmp/rpmbuild -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r tmp/rpmbuild

# build a VM with locally built distro pkgs installed
$(VM_IMAGE): $(TARFILE) $(NODE_CACHE) packaging/debian/rules packaging/debian/control packaging/arch/PKGBUILD bots
	bots/image-customize --verbose --fresh $(VM_CUSTOMIZE_FLAGS) --script $(CURDIR)/test/vm.install $(TEST_OS)

# convenience target for the above
vm: $(VM_IMAGE)
	@echo $(VM_IMAGE)

# convenience target to print the filename of the test image
print-vm:
	@echo $(VM_IMAGE)

# run static code checks for python code
PYEXEFILES=$(shell git grep -lI '^#!.*python')

codecheck: test/common $(NODE_MODULES_TEST)
	test/common/static-code

# convenience target to setup all the bits needed for the integration tests
# without actually running them
prepare-check: $(NODE_MODULES_TEST) $(VM_IMAGE) test/common test/reference

# run the browser integration tests; skip check for SELinux denials
# this will run all tests/check-* and format them as TAP
check: prepare-check
	TEST_AUDIT_NO_SELINUX=1 test/common/run-tests ${RUN_TESTS_OPTIONS}

bots: $(COCKPIT_REPO_STAMP)
	test/common/make-bots

test/reference: test/common
	test/common/pixel-tests pull

# We want tools/node-modules to run every time package-lock.json is requested
# See https://www.gnu.org/software/make/manual/html_node/Force-Targets.html
FORCE:
$(NODE_MODULES_TEST): FORCE tools/node-modules
	tools/node-modules make_package_lock_json

.PHONY: all clean install devel-install devel-uninstall print-version dist rpm prepare-check check vm print-vm
