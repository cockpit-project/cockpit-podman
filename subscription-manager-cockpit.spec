Name: subscription-manager-cockpit
Version: 1
Release: 0
Summary: Subscription Manager Cockpit UI
License: LGPLv2.1+

Source: subscription-manager-cockpit.tar.gz
BuildArch: noarch

Requires: subscription-manager

%define debug_package %{nil}

%description
Subscription Manager Cockpit UI

%prep

%build

%install
mkdir -p %{buildroot}
tar --strip-components=1 -xzf %{sources} -C %{buildroot}
find %{buildroot} -type f >> files.list
sed -i "s|%{buildroot}||" *.list

%files -f files.list
