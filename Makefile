all:
	npm run build

clean:
	rm -rf dist/
	rm -rf _install

install: all
	mkdir -p /usr/share/cockpit/subscription-manager
	cp -r dist/* /usr/share/cockpit/subscription-manager

dist-gzip: all
	mkdir -p _install/usr/share/cockpit
	cp -r dist/ _install/usr/share/cockpit/subscription-manager
	mkdir -p _install/usr/share/metainfo/
	cp *.metainfo.xml _install/usr/share/metainfo/
	cp subscription-manager-cockpit.spec _install/
	tar -C _install/ -czf subscription-manager-cockpit.tar.gz .
	rm -rf _install

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
