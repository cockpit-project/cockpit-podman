# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := cockpit-$(PACKAGE_NAME)
VERSION := $(shell T=$$(git describe 2>/dev/null) || T=1; echo $$T | tr '-' '.')
ifeq ($(TEST_OS),)
TEST_OS = fedora-37
endif
export TEST_OS
TARFILE=$(RPM_NAME)-$(VERSION).tar.xz
NODE_CACHE=$(RPM_NAME)-node-$(VERSION).tar.xz
SPEC=$(RPM_NAME).spec
APPSTREAMFILE=org.cockpit-project.$(PACKAGE_NAME).metainfo.xml
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
# stamp file to check for node_modules/
NODE_MODULES_TEST=package-lock.json
# one example file in dist/ from webpack to check if that already ran
WEBPACK_TEST=dist/manifest.json
# one example file in pkg/lib to check if it was already checked out
COCKPIT_REPO_STAMP=pkg/lib/cockpit-po-plugin.js
# common arguments for tar, mostly to make the generated tarballs reproducible
TAR_ARGS = --sort=name --mtime "@$(shell git show --no-patch --format='%at')" --mode=go=rX,u+rw,a-s --numeric-owner --owner=0 --group=0

ifeq ($(TEST_COVERAGE),yes)
RUN_TESTS_OPTIONS+=--coverage
NODE_ENV=development
endif

all: $(WEBPACK_TEST)

# checkout common files from Cockpit repository required to build this project;
# this has no API stability guarantee, so check out a stable tag when you start
# a new project, use the latest release, and update it from time to time
COCKPIT_REPO_FILES = \
	pkg/lib \
	test/common \
	tools/git-utils.sh \
	tools/make-bots \
	tools/node-modules \
	$(NULL)

COCKPIT_REPO_URL = https://github.com/cockpit-project/cockpit.git
COCKPIT_REPO_COMMIT = 54f2fd58a3645c4a222e2b1b9b5f1b9321bed998 # 285 + Move to a webpack module

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
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ --language=C --keyword= \
		--keyword=_:1,1t --keyword=_:1c,2,2t --keyword=C_:1c,2 \
		--keyword=N_ --keyword=NC_:1c,2 \
		--keyword=gettext:1,1t --keyword=gettext:1c,2,2t \
		--keyword=ngettext:1,2,3t --keyword=ngettext:1c,2,3,4t \
		--keyword=gettextCatalog.getString:1,3c --keyword=gettextCatalog.getPlural:2,3,4c \
		--from-code=UTF-8 $$(find src/ -name '*.js' -o -name '*.jsx')

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	pkg/lib/html2po.js -o $@ $$(find src -name '*.html')

po/$(PACKAGE_NAME).manifest.pot: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	pkg/lib/manifest2po.js src/manifest.json -o $@

po/$(PACKAGE_NAME).metainfo.pot: $(APPSTREAMFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ $<

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot po/$(PACKAGE_NAME).metainfo.pot
	msgcat --sort-output --output-file=$@ $^

po/LINGUAS:
	echo $(LINGUAS) | tr ' ' '\n' > $@

#
# Build/Install/dist
#

%.spec: packaging/%.spec.in
	sed -e 's/%{VERSION}/$(VERSION)/g' $< > $@

packaging/arch/PKGBUILD: packaging/arch/PKGBUILD.in
	sed 's/VERSION/$(VERSION)/; s/SOURCE/$(TARFILE)/' $< > $@

packaging/debian/changelog: packaging/debian/changelog.in
	sed 's/VERSION/$(VERSION)/' $< > $@

$(WEBPACK_TEST): $(COCKPIT_REPO_STAMP) $(shell find src/ -type f) package.json webpack.config.js
	$(MAKE) package-lock.json && NODE_ENV=$(NODE_ENV) node_modules/.bin/webpack
	# In development mode terser does not run and so no LICENSE.txt.gz is generated, so we explictly create it as it is required for building rpm's
	if [ "$$NODE_ENV" = "development" ]; then \
		gzip </dev/null >dist/index.js.LICENSE.txt.gz; \
	fi

watch:
	NODE_ENV=$(NODE_ENV) node_modules/.bin/webpack --watch

clean:
	rm -rf dist/
	rm -f $(SPEC) packaging/arch/PKGBUILD packaging/debian/changelog
	rm -f po/LINGUAS

install: $(WEBPACK_TEST) po/LINGUAS
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	msgfmt --xml -d po \
		--template $(APPSTREAMFILE) \
		-o $(DESTDIR)/usr/share/metainfo/$(APPSTREAMFILE)

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(WEBPACK_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -s `pwd`/dist ~/.local/share/cockpit/$(PACKAGE_NAME)

# assumes that there was symlink set up using the above devel-install target,
# and removes it
devel-uninstall:
	rm -f ~/.local/share/cockpit/$(PACKAGE_NAME)

print-version:
	@echo "$(VERSION)"

# required for running integration tests; commander and ws are deps of chrome-remote-interface
TEST_NPMS = \
       node_modules/chrome-remote-interface \
       node_modules/commander \
       node_modules/sizzle \
       node_modules/ws \
       $(NULL)

dist: $(TARFILE)
	@ls -1 $(TARFILE)

# when building a distribution tarball, call webpack with a 'production' environment by default
# we don't ship most node_modules for license and compactness reasons, only the ones necessary for running tests
# we ship a pre-built dist/ (so it's not necessary) and ship package-lock.json (so that node_modules/ can be reconstructed if necessary)
$(TARFILE): export NODE_ENV ?= production
$(TARFILE): $(WEBPACK_TEST) $(SPEC) packaging/arch/PKGBUILD packaging/debian/changelog
	if type appstream-util >/dev/null 2>&1; then appstream-util validate-relax --nonet *.metainfo.xml; fi
	tar --xz $(TAR_ARGS) -cf $(TARFILE) --transform 's,^,$(RPM_NAME)/,' \
		--exclude '*.in' --exclude test/reference \
		$$(git ls-files | grep -v node_modules) \
		$(COCKPIT_REPO_FILES) $(NODE_MODULES_TEST) $(SPEC) $(TEST_NPMS) \
		packaging/arch/PKGBUILD packaging/debian/changelog dist/

# convenience target for developers
rpm: $(TARFILE)
	rpmbuild -tb --define "_topdir $(CURDIR)/tmp/rpmbuild" $(TARFILE)
	find tmp/rpmbuild -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r tmp/rpmbuild

# pybridge scenario: build and install the python bridge from cockpit repo
ifeq ("$(TEST_SCENARIO)","pybridge")
COCKPIT_PYBRIDGE_REF = main
COCKPIT_WHEEL = cockpit-0-py3-none-any.whl

$(COCKPIT_WHEEL):
	# aka: pip wheel git+https://github.com/cockpit-project/cockpit.git@${COCKPIT_PYBRIDGE_REF}
	rm -rf tmp/pybridge
	git init tmp/pybridge
	git -C tmp/pybridge remote add origin https://github.com/cockpit-project/cockpit
	git -C tmp/pybridge fetch --depth=1 origin ${COCKPIT_PYBRIDGE_REF}
	git -C tmp/pybridge reset --hard FETCH_HEAD
	cp "$$(tmp/pybridge/tools/make-wheel)" $@

VM_DEPENDS = $(COCKPIT_WHEEL)
VM_CUSTOMIZE_FLAGS = --install $(COCKPIT_WHEEL)
endif

# build a VM with locally built distro pkgs installed
$(VM_IMAGE): $(TARFILE) packaging/debian/rules packaging/debian/control packaging/arch/PKGBUILD bots $(VM_DEPENDS)
	# HACK for ostree images: skip the rpm build/install
	if [ "$$TEST_OS" = "fedora-coreos" ] || [ "$$TEST_OS" = "rhel4edge" ]; then \
	    bots/image-customize --verbose --fresh --no-network --run-command 'mkdir -p /usr/local/share/cockpit' \
	                         --upload dist/:/usr/local/share/cockpit/podman \
	                         --script $(CURDIR)/test/vm.install $(TEST_OS); \
	else \
	    bots/image-customize --verbose --fresh --no-network $(VM_CUSTOMIZE_FLAGS) --build $(TARFILE) --script $(CURDIR)/test/vm.install $(TEST_OS); \
	fi

# convenience target for the above
vm: $(VM_IMAGE)
	@echo $(VM_IMAGE)

# convenience target to print the filename of the test image
print-vm:
	@echo $(VM_IMAGE)

# run static code checks for python code
PYEXEFILES=$(shell git grep -lI '^#!.*python')

codecheck:
	flake8 $(PYEXEFILES)

# convenience target to setup all the bits needed for the integration tests
# without actually running them
prepare-check: $(NODE_MODULES_TEST) $(VM_IMAGE) test/common test/reference

# run the browser integration tests; skip check for SELinux denials
# this will run all tests/check-* and format them as TAP
check: prepare-check
	TEST_AUDIT_NO_SELINUX=1 test/common/run-tests ${RUN_TESTS_OPTIONS}

bots: tools/make-bots
	tools/make-bots

test/reference: test/common
	test/common/pixel-tests pull

# We want tools/node-modules to run every time package-lock.json is requested
# See https://www.gnu.org/software/make/manual/html_node/Force-Targets.html
FORCE:
$(NODE_MODULES_TEST): FORCE tools/node-modules
	tools/node-modules make_package_lock_json

.PHONY: all clean install devel-install devel-uninstall print-version dist rpm prepare-check check vm print-vm
