#!/usr/bin/env python3
"""Submit only the image URI to the fixed SSM document and wait for its result."""
import argparse
import json
import re
import subprocess
import sys
import time

REGION = 'ap-southeast-7'
IMAGE_PATTERN = r'147997138960\.dkr\.ecr\.ap-southeast-7\.amazonaws\.com/property-app-dev:sha-[0-9a-f]{40}-run-[0-9]+-[0-9]+'


def aws(*args):
    return subprocess.run(['aws', '--region', REGION, '--no-cli-pager', 'ssm', *args, '--output', 'json'],
                          text=True, capture_output=True, timeout=40)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--instance', required=True)
    parser.add_argument('--document', required=True)
    args = parser.parse_args()
    if not re.fullmatch(IMAGE_PATTERN, args.image):
        parser.error('Expected a versioned image in property-app-dev.')
    if not re.fullmatch(r'i-[0-9a-f]{17}', args.instance):
        parser.error('Expected an EC2 instance ID.')
    if not re.fullmatch(r'[A-Za-z0-9_.-]{3,128}', args.document):
        parser.error('Invalid SSM document name.')
    submitted = aws('send-command', '--instance-ids', args.instance, '--document-name', args.document,
                    '--document-version', '$LATEST', '--timeout-seconds', '60',
                    '--parameters', json.dumps({'ImageUri': [args.image]}),
                    '--comment', 'Deploy versioned property app image')
    if submitted.returncode:
        print(submitted.stderr, file=sys.stderr)
        return 1
    command_id = json.loads(submitted.stdout)['Command']['CommandId']
    print(f'SSM command: {command_id}', flush=True)
    deadline = time.monotonic() + 1600
    while time.monotonic() < deadline:
        result = aws('get-command-invocation', '--command-id', command_id, '--instance-id', args.instance)
        if result.returncode:
            if 'InvocationDoesNotExist' not in result.stderr:
                print(result.stderr, file=sys.stderr)
                return 1
        else:
            invocation = json.loads(result.stdout)
            status = invocation['Status']
            if status not in {'Pending', 'InProgress', 'Delayed', 'Cancelling'}:
                print(f'SSM result: {status}')
                print(invocation.get('StandardOutputContent', ''))
                print(invocation.get('StandardErrorContent', ''), file=sys.stderr)
                return 0 if status == 'Success' else 1
        time.sleep(5)
    print('Timed out waiting. Check the SSM command before starting another deployment.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
