PACKAGE_NAME := $(shell python3 -c "import json; print(json.load(open('package.json'))['name'])")

all:
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
