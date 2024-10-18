# Usage:
#   python install_helper.py [env]
#
# Where env is 'dev', 'stg', or 'prod'. This script will also call the correct npm install command.

import json
import subprocess
import sys


def run_cmd(cmd_arr, show_log=True):
    if show_log:
        print(f'🏃 {" ".join(cmd_arr)}')
    process = subprocess.run(cmd_arr, stdout=subprocess.PIPE)
    return process.stdout.decode('utf-8')


def get_env_arg():
    env = sys.argv[1]
    if env not in ['dev', 'stg', 'prod']:
        raise ValueError(f'env must be dev/stg/prod. got: {env}')
    return env


def find_latest_version_in_npm(is_alpha=False):
    versions_output = run_cmd(
        ['npm', 'view', '@getopenpay/openpay-js-react', 'versions', '--json'],
        show_log=False)
    versions = json.loads(versions_output)
    versions = list(reversed(versions))
    alpha_only_filter = lambda x: 'alpha' in x
    non_alpha_filter = lambda x: 'alpha' not in x
    version_filter = alpha_only_filter if is_alpha else non_alpha_filter
    return next(ver for ver in versions if version_filter(ver))


def get_package_to_install():
    env = get_env_arg()
    if env == 'dev':
        return '../'
    elif env == 'stg':
        ver = find_latest_version_in_npm(is_alpha=True)
        return f'@getopenpay/openpay-js-react@{ver}'
    else:
        ver = find_latest_version_in_npm(is_alpha=False)
        return f'@getopenpay/openpay-js-react@{ver}'


def main():
    package_to_install = get_package_to_install()
    run_cmd(['npm', 'uninstall', '@getopenpay/openpay-js-react'])
    run_cmd(['npm', 'cache', 'clean', '--force'])
    run_cmd(['npm', 'install', '--save-exact', package_to_install])
    print(f'✅ Installed {package_to_install}')


main()
