all:
	NODE_ENV=$(NODE_ENV) npm run build

clean:
	rm -rf dist/
	rm -rf _install

install: all install-only

install-only:
	mkdir -p $(DESTDIR)/usr/share/cockpit/subscription-manager
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/subscription-manager
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	cp org.cockpit-project.subscription-manager.metainfo.xml $(DESTDIR)/usr/share/metainfo/

EXTRA_DIST = \
	README.md \
	org.cockpit-project.subscription-manager.metainfo.xml \
	package.json \
        .eslintrc.json \
	webpack.config.js \
	webpack-with-stats \
	Makefile

# when building a distribution tarball, call webpack with a 'production' environment
dist-gzip: NODE_ENV=production
dist-gzip: clean all
	tar czf subscription-manager-cockpit.tar.gz --transform 's,^,subscription-manager-cockpit/,' $$(cat webpack.inputs) $(EXTRA_DIST) dist/

srpm: dist-gzip
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
	  --define "_srcrpmdir `pwd`" \
	  subscription-manager-cockpit.spec

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
	  subscription-manager-cockpit.spec
	find `pwd`/output -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r "`pwd`/rpmbuild"
