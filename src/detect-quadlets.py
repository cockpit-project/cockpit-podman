#!/usr/bin/python3

"""
Detect quadlet containers/pods on the system

{'service-name': {
    'name': 'container_name',
    'pod':  'pod'
  }
}


"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import DefaultDict, Dict, Optional


def extract_key(line: str, key: str) -> str:
    return line.strip().replace(key, '')


def get_name(service_name: str, name: Optional[str]) -> str:
    if name is not None:
        return name
    # Generated pods have -pod appended
    return 'systemd-' + service_name.replace('-pod.service', '').replace('.service', '')


def main(generator_dir: Path) -> None:
    containers: DefaultDict[str, Dict[str, Optional[str]]] = defaultdict(dict)
    pods: DefaultDict[str, Dict[str, Optional[str]]] = defaultdict(dict)

    try:
        for entry in os.scandir(generator_dir):
            if not entry.name.endswith('.service'):
                continue

            with open(generator_dir / entry.name, 'r') as fp:
                source_path = None
                name = None
                cmd = None
                image = None
                pod = None
                for line in fp.readlines():
                    if line.startswith('SourcePath='):
                        source_path = extract_key(line, 'SourcePath=')

                    if line.startswith('PodName='):
                        name = extract_key(line, 'PodName=')

                    if line.startswith('ContainerName='):
                        name = extract_key(line, 'ContainerName=')

                    if line.startswith('Exec='):
                        cmd = extract_key(line, 'Exec=')

                    if line.startswith('Image='):
                        image = extract_key(line, 'Image=')

                    # Corresponds to the pod unit name
                    if line.startswith('Pod='):
                        pod = extract_key(line, 'Pod=')

                # For example: sshd-unix-local@.service
                if source_path is None:
                    continue

                if source_path.endswith('.pod'):
                    pods[entry.name] = {'source_path': source_path, 'name': get_name(entry.name, name)}
                elif source_path.endswith('.container'):
                    service = {'source_path': source_path, 'name': get_name(entry.name, name),
                               'exec': cmd or "", 'image': image}
                    if pod is not None:
                        service['pod'] = pod

                    containers[entry.name] = service
    except FileNotFoundError as exc:
        print(f'Generator directory or unit not found: "{exc}"', file=sys.stderr)
        sys.exit(2)

    print(json.dumps({
        'pods': pods,
        'containers': containers,
    }))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print('missing required generator dir argument', file=sys.stderr)
        sys.exit(1)

    main(Path(sys.argv[1]))
