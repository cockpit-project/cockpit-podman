# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := cockpit-$(PACKAGE_NAME)
VERSION := $(shell T=$$(git describe 2>/dev/null) || T=1; echo $$T | tr '-' '.')
ifeq ($(TEST_OS),)
TEST_OS = fedora-33
endif
export TEST_OS
TARFILE=cockpit-$(PACKAGE_NAME)-$(VERSION).tar.gz
RPMFILE=$(shell rpmspec -D"VERSION $(VERSION)" -q `ls cockpit-podman.spec.in cockpit-podman.spec 2>/dev/null | head -n1`).rpm
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
# stamp file to check if/when npm install ran
NODE_MODULES_TEST=package-lock.json
# one example file in dist/ from webpack to check if that already ran
WEBPACK_TEST=dist/manifest.json

WEBLATE_REPO=tmp/weblate-repo
WEBLATE_REPO_URL=https://github.com/cockpit-project/cockpit-podman-weblate.git
WEBLATE_REPO_BRANCH=master

all: $(WEBPACK_TEST)

#
# i18n
#

LINGUAS=$(basename $(notdir $(wildcard po/*.po)))

po/$(PACKAGE_NAME).js.pot:
	xgettext --default-domain=cockpit --output=$@ --language=C --keyword= \
		--keyword=_:1,1t --keyword=_:1c,2,1t --keyword=C_:1c,2 \
		--keyword=N_ --keyword=NC_:1c,2 \
		--keyword=gettext:1,1t --keyword=gettext:1c,2,2t \
		--keyword=ngettext:1,2,3t --keyword=ngettext:1c,2,3,4t \
		--keyword=gettextCatalog.getString:1,3c --keyword=gettextCatalog.getPlural:2,3,4c \
		--from-code=UTF-8 $$(find src/ -name '*.js' -o -name '*.jsx')

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_TEST)
	po/html2po -o $@ $$(find src -name '*.html')

po/$(PACKAGE_NAME).manifest.pot: $(NODE_MODULES_TEST)
	po/manifest2po src/manifest.json -o $@

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot
	msgcat --sort-output --output-file=$@ $^

# Update translations against current PO template
update-po: po/$(PACKAGE_NAME).pot
	for lang in $(LINGUAS); do \
		msgmerge --output-file=po/$$lang.po po/$$lang.po $<; \
	done

$(WEBLATE_REPO):
	git clone --depth=1 -b $(WEBLATE_REPO_BRANCH) $(WEBLATE_REPO_URL) $(WEBLATE_REPO)

upload-pot: po/$(PACKAGE_NAME).pot $(WEBLATE_REPO)
	cp ./po/$(PACKAGE_NAME).pot $(WEBLATE_REPO)
	git -C $(WEBLATE_REPO) commit -m "Update source file" -- $(PACKAGE_NAME).pot
	git -C $(WEBLATE_REPO) push

clean-po:
	rm ./po/*.po

download-po: $(WEBLATE_REPO)
	cp $(WEBLATE_REPO)/*.po ./po/

#
# Build/Install/dist
#

%.spec: %.spec.in
	sed -e 's/%{VERSION}/$(VERSION)/g' $< > $@

$(WEBPACK_TEST): $(NODE_MODULES_TEST) lib/patternfly/_fonts.scss $(shell find src/ -type f) package.json webpack.config.js
	NODE_ENV=$(NODE_ENV) npm run build

watch:
	NODE_ENV=$(NODE_ENV) npm run watch

clean:
	rm -rf dist/
	[ ! -e $(RPM_NAME).spec.in ] || rm -f $(RPM_NAME).spec

install: $(WEBPACK_TEST)
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	cp org.cockpit-project.$(PACKAGE_NAME).metainfo.xml $(DESTDIR)/usr/share/metainfo/

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(WEBPACK_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -s `pwd`/dist ~/.local/share/cockpit/$(PACKAGE_NAME)

dist-gzip: $(TARFILE)
	@ls -1 $(TARFILE)

# when building a distribution tarball, call webpack with a 'production' environment
# we don't ship node_modules for license and compactness reasons; we ship a
# pre-built dist/ (so it's not necessary) and ship packge-lock.json (so that
# node_modules/ can be reconstructed if necessary)
$(TARFILE): NODE_ENV=production
$(TARFILE): $(WEBPACK_TEST) $(RPM_NAME).spec
	mv node_modules node_modules.release
	touch -r package.json $(NODE_MODULES_TEST)
	touch dist/*
	tar czf $(TARFILE) --transform 's,^,cockpit-$(PACKAGE_NAME)/,' \
		--exclude $(RPM_NAME).spec.in \
		$$(git ls-files) lib/patternfly/*.scss package-lock.json $(RPM_NAME).spec dist/
	mv node_modules.release node_modules

srpm: $(TARFILE) $(RPM_NAME).spec
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
	  --define "_srcrpmdir `pwd`" \
	  $(RPM_NAME).spec

rpm: $(RPMFILE)

$(RPMFILE): $(TARFILE) $(RPM_NAME).spec
	mkdir -p "`pwd`/output"
	mkdir -p "`pwd`/rpmbuild"
	rpmbuild -bb \
	  --define "_sourcedir `pwd`" \
	  --define "_specdir `pwd`" \
	  --define "_builddir `pwd`/rpmbuild" \
	  --define "_srcrpmdir `pwd`" \
	  --define "_rpmdir `pwd`/output" \
	  --define "_buildrootdir `pwd`/build" \
	  $(RPM_NAME).spec
	find `pwd`/output -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r "`pwd`/rpmbuild"
	rm -r "`pwd`/output" "`pwd`/build"
	# sanity check
	test -e "$(RPMFILE)"

# determine what to depend on and do for Fedora/RHEL/Debian VM preparation
ifneq ($(filter debian-% ubuntu-%,$(TEST_OS)),)
VM_DEP=$(TARFILE) packaging/debian/rules packaging/debian/control
VM_PACKAGE=--upload `pwd`/$(TARFILE):/var/tmp/ --upload `pwd`/packaging/debian:/var/tmp/
else
VM_DEP=$(RPMFILE)
VM_PACKAGE=--install cockpit-ws --install `pwd`/$(RPMFILE)
endif

ifeq ($(TEST_SCENARIO),rawhide)
# needs to run as a separate command, as --run-command is executed before --script
RAWHIDE=bots/image-customize -v --run-command 'dnf update -y --releasever=$$(. /etc/os-release; echo $$(( VERSION_ID + 1)) ) podman conmon crun containernetworking-plugins containers-common kernel' $(TEST_OS)
endif

# build a VM with locally built rpm/dsc installed
$(VM_IMAGE): $(VM_DEP) bots
	rm -f $(VM_IMAGE) $(VM_IMAGE).qcow2
	bots/image-customize -v $(VM_PACKAGE) -s $(CURDIR)/test/vm.install $(TEST_OS)
	$(RAWHIDE)
	# HACK: systemd kills the services after 90s
	# See https://github.com/containers/podman/issues/8751
	bots/image-customize -r "sed -i 's/Type=notify/Type=exec/' /usr/lib/systemd/system/podman.service" -r "sed -i 's/Type=notify/Type=exec/' /usr/lib/systemd/user/podman.service" $(TEST_OS)


# convenience target for the above
vm: $(VM_IMAGE)
	echo $(VM_IMAGE)

# run the browser integration tests; skip check for SELinux denials
check: $(NODE_MODULES_TEST) $(VM_IMAGE) test/common
	TEST_AUDIT_NO_SELINUX=1 test/common/run-tests

# checkout Cockpit's bots for standard test VM images and API to launch them
# must be from master, as only that has current and existing images; but testvm.py API is stable
# support CI testing against a bots change
bots:
	git clone --quiet --reference-if-able $${XDG_CACHE_HOME:-$$HOME/.cache}/cockpit-project/bots https://github.com/cockpit-project/bots.git
	if [ -n "$$COCKPIT_BOTS_REF" ]; then git -C bots fetch --quiet --depth=1 origin "$$COCKPIT_BOTS_REF"; git -C bots checkout --quiet FETCH_HEAD; fi
	@echo "checked out bots/ ref $$(git -C bots rev-parse HEAD)"

# checkout Cockpit's test API; this has no API stability guarantee, so check out a stable tag
# when you start a new project, use the latest release, and update it from time to time
test/common:
	flock Makefile sh -ec '\
	    git fetch --depth=1 https://github.com/cockpit-project/cockpit.git 234; \
	    git checkout --force FETCH_HEAD -- test/common; \
	    git reset test/common'

lib/patternfly/_fonts.scss:
	flock Makefile sh -ec '\
	    git fetch --depth=1 https://github.com/cockpit-project/cockpit.git 234; \
	    mkdir -p pkg/lib/patternfly && git add pkg/lib/patternfly; \
	    git checkout --force FETCH_HEAD -- pkg/lib/patternfly; \
	    git reset -- pkg/lib/patternfly'
	mkdir -p lib && mv pkg/lib/patternfly lib/patternfly && rmdir -p pkg/lib

$(NODE_MODULES_TEST): package.json
	# if it exists already, npm install won't update it; force that so that we always get up-to-date packages
	rm -f package-lock.json
	# unset NODE_ENV, skips devDependencies otherwise
	env -u NODE_ENV npm install
	env -u NODE_ENV npm prune

.PHONY: all clean install devel-install dist-gzip srpm rpm check vm update-po
