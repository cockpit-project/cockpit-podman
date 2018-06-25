Vagrant.configure(2) do |config|
    config.vm.box = "fedora/28-cloud-base"
    config.vm.network "forwarded_port", guest: 9090, host: 9090

    if Dir.glob("dist/*").length == 0
      config.vm.post_up_message = "NOTE: Distribution directory is empty. Run `make` to see your module show up in cockpit"
    end

    config.vm.synced_folder ".", "/vagrant", disabled: true
    config.vm.synced_folder "dist/", "/usr/local/share/cockpit/" + File.basename(Dir.pwd), type: "rsync", create: true

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
