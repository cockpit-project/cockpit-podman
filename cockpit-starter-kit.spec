Name: cockpit-starter-kit
Version: 1
Release: 0
Summary: Cockpit Starter Kit Example Module
License: LGPLv2.1+

Source: cockpit-starter-kit.tar.gz
BuildArch: noarch

%define debug_package %{nil}

%description
Cockpit Starter Kit Example Module

%prep
%setup -n cockpit-starter-kit

%build

%install
make install-only DESTDIR=%{buildroot}
find %{buildroot} -type f >> files.list
sed -i "s|%{buildroot}||" *.list

%files -f files.list
