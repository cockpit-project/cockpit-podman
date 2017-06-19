all:
	npm run build

clean:
	rm -rf dist/
	rm -rf _install

install: all
	mkdir -p /usr/share/cockpit
	cp -r dist/ /usr/share/cockpit/subscription-manager

srpm: clean all
	mkdir -p _install/usr/share/cockpit
	cp -r dist/ _install/usr/share/cockpit/subscription-manager
	mkdir -p _install/usr/share/metainfo/
	cp *.metainfo.xml _install/usr/share/metainfo/
	tar -C _install/ -czf subscription-manager-cockpit.tar.gz .
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
          --define "_srcrpmdir `pwd`" \
          subscription-manager-cockpit.spec
