#!/usr/bin/python3
# SPDX-License-Identifier: LGPL-2.1-or-later

"""
Detect quadlet containers/pods on the system

{"service-name": {
    "name": "container_name",
    "pod":  "pod"
  }
}


"""

import json
import os
import shlex
import sys
from collections import defaultdict
from pathlib import Path
from typing import DefaultDict, Dict, List, Optional, Union


def get_name(service_name: str, name: Optional[str]) -> str:
    if name is not None:
        return name
    # Generated pods have -pod appended
    return 'systemd-' + service_name.replace('-pod.service', '').replace('.service', '')


def main(generator_dir: Path) -> None:
    containers: DefaultDict[str, Dict[str, Union[Optional[str], List[str]]]] = defaultdict(dict)
    pods: DefaultDict[str, Dict[str, Optional[str]]] = defaultdict(dict)

    try:
        entries = os.scandir(generator_dir)
    except FileNotFoundError as exc:
        print(f'Generator directory or unit not found: "{exc}"', file=sys.stderr)
        sys.exit(2)

    for entry in entries:
        if not entry.name.endswith('.service'):
            continue

        with open(generator_dir / entry.name, 'r') as fp:
            source_path = None
            name = None
            cmd = None
            image = None
            pod = None
            for line in fp.readlines():
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip()

                if key == "SourcePath":
                    source_path = value
                    continue
                elif key == "PodName":
                    name = value
                    continue
                elif key == "ContainerName":
                    name = value
                    continue
                elif key == "Exec":
                    cmd = shlex.split(value)
                    continue
                elif key == "Image":
                    image = value
                    continue
                # Corresponds to the pod unit name
                elif key == "Pod":
                    pod = value
                    continue

            # For example: sshd-unix-local@.service
            if source_path is None:
                continue

            if source_path.endswith('.pod'):
                pods[entry.name] = {'source_path': source_path, 'name': get_name(entry.name, name)}
            elif source_path.endswith('.container'):
                service = {'source_path': source_path, 'name': get_name(entry.name, name),
                           'exec': cmd, 'image': image}
                service['pod'] = pod

                containers[entry.name] = service

    print(json.dumps({
        'pods': pods,
        'containers': containers,
    }))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print('missing required generator dir argument', file=sys.stderr)
        sys.exit(1)

    main(Path(sys.argv[1]))
