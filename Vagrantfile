Vagrant.configure(2) do |config|
    config.vm.box = "fedora/25-cloud-base"
    config.vm.network "forwarded_port", guest: 9090, host: 9090

    config.vm.synced_folder ".", "/vagrant", disabled: true
    config.vm.synced_folder "dist/", "/usr/local/share/cockpit/" + File.basename(Dir.pwd)

    config.vm.provider "libvirt" do |libvirt|
        libvirt.memory = 1024
    end

    config.vm.provider "virtualbox" do |virtualbox|
        virtualbox.memory = 1024
    end

    config.vm.provision "shell", inline: <<-EOF
        set -eu

        sudo dnf install -y cockpit

        printf "[WebService]\nAllowUnencrypted=true\n" > /etc/cockpit/cockpit.conf

        systemctl enable cockpit.socket
        systemctl start cockpit.socket
    EOF
end
