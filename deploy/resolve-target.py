#!/usr/bin/env python3
"""Resolve the live deployment target, retaining the legacy variable fallback."""
import json
import os
import re
import subprocess
import sys

PARAMETER = '/property-app/dev/deployment/instance-id'


def resolve(parameter, legacy_instance, aws_run=subprocess.run):
    if parameter:
        if parameter != PARAMETER:
            raise ValueError('EC2_TARGET_PARAMETER must be the property deployment target path.')
        result = aws_run(['aws', '--region', 'ap-southeast-7', '--no-cli-pager',
                          'ssm', 'get-parameter', '--name', parameter, '--output', 'json'],
                         capture_output=True, text=True, timeout=40)
        if result.returncode:
            raise ValueError('Cannot read the deployment target; check the parameter and OIDC role permission.')
        try:
            instance = json.loads(result.stdout)['Parameter']['Value']
        except (ValueError, KeyError, TypeError):
            raise ValueError('Deployment target response is invalid.') from None
    else:
        instance = legacy_instance
    if instance == 'offline':
        raise ValueError('The lab is offline. Recreate it with HCP Terraform before deploying.')
    if not isinstance(instance, str) or not re.fullmatch(r'i-[0-9a-f]{17}', instance):
        raise ValueError('The deployment target is not a valid EC2 instance ID.')
    return instance


if __name__ == '__main__':
    try:
        instance = resolve(os.environ.get('TARGET_PARAMETER', ''), os.environ.get('LEGACY_INSTANCE_ID', ''))
        print(f'instance_id={instance}')
    except (ValueError, subprocess.SubprocessError) as error:
        sys.exit(str(error))
