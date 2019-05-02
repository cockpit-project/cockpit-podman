# cockpit-podman

This is the [Cockpit](https://cockpit-project.org/) user interface for [podman
containers](https://podman.io/).

It does not have a lot of features yet, and is still far from feature parity
with [cockpit-docker](https://cockpit-project.org/guide/latest/feature-docker.html).
For now you can do basic image and container tasks for system containers (no
support for user containers yet).

## Technologies

 - cockpit-podman communicates to podman through its
   [varlink](https://varlink.org/)
   [protocol](https://github.com/containers/libpod/blob/master/cmd/podman/varlink/io.podman.varlink).
   See this [blog post](http://www.projectatomic.io/blog/2018/05/podman-varlink/) for examples.

 - This project is based on the [Cockpit Starter Kit](https://github.com/cockpit-project/starter-kit).
   See [Starter Kit Intro](http://cockpit-project.org/blog/cockpit-starter-kit.html) for details.
