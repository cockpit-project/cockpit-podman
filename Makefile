PACKAGE_NAME := $(shell python3 -c "import json; print(json.load(open('package.json'))['name'])")
ifeq ($(TEST_OS),)
TEST_OS = centos-7
endif
export TEST_OS
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)

all: node_modules/react-lite
	NODE_ENV=$(NODE_ENV) npm run build

clean:
	rm -rf dist/
	rm -rf _install

install: all install-only

install-only:
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	cp org.cockpit-project.$(PACKAGE_NAME).metainfo.xml $(DESTDIR)/usr/share/metainfo/

# when building a distribution tarball, call webpack with a 'production' environment
dist-gzip: NODE_ENV=production
dist-gzip: clean all
	tar czf cockpit-$(PACKAGE_NAME).tar.gz --transform 's,^,cockpit-$(PACKAGE_NAME)/,' $$(git ls-files) dist/

srpm: dist-gzip
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
	  --define "_srcrpmdir `pwd`" \
	  cockpit-$(PACKAGE_NAME).spec

rpm: dist-gzip
	mkdir -p "`pwd`/output"
	mkdir -p "`pwd`/rpmbuild"
	rpmbuild -bb \
	  --define "_sourcedir `pwd`" \
	  --define "_specdir `pwd`" \
	  --define "_builddir `pwd`/rpmbuild" \
	  --define "_srcrpmdir `pwd`" \
	  --define "_rpmdir `pwd`/output" \
	  --define "_buildrootdir `pwd`/build" \
	  cockpit-$(PACKAGE_NAME).spec
	find `pwd`/output -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r "`pwd`/rpmbuild"
	rm -r "`pwd`/output" "`pwd`/build"

# build a VM with locally built cockpit-starter-kit.rpm installed
$(VM_IMAGE): rpm bots
	bots/image-customize -v -r 'rpm -e cockpit-starter-kit || true' -i cockpit -i `pwd`/cockpit-starter-kit-*.noarch.rpm -s $(CURDIR)/test/vm.install $(TEST_OS)

# run the browser integration tests; skip check for SELinux denials
check: node_modules/react-lite $(VM_IMAGE) test/common
	TEST_AUDIT_NO_SELINUX=1 test/check-starter-kit

# checkout Cockpit's bots/ directory for standard test VM images and API to launch them
bots:
	git fetch --depth=1 https://github.com/cockpit-project/cockpit.git
	git checkout --force FETCH_HEAD -- bots/
	git reset bots

# checkout Cockpit's test API
test/common:
	# when running in CI, update FETCH_HEAD to cockpit repo
	if git remote | grep -qF test; then git fetch origin master; fi
	git checkout --force FETCH_HEAD -- test/common
	git reset test/common

node_modules/react-lite:
	npm install

.PHONY: all clean install install-only dist-gzip srpm rpm check
