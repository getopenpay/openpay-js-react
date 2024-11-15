"""Helper script to install OPJS packages with specific version constraints."""

# Usage:
#   python install_helper.py [env] [package_name]
#
# Where env is 'dev', 'alpha', or 'latest'. This script will also call the correct npm install command.

import json
import subprocess
import sys


def run_cmd(cmd_arr, show_log=True):
    if show_log:
        print(f'🏃 {" ".join(cmd_arr)}')
    process = subprocess.run(cmd_arr, stdout=subprocess.PIPE, check=True)
    return process.stdout.decode('utf-8')


def get_env_arg():
    env = sys.argv[1]
    package_name = sys.argv[2]
    if env not in ['dev', 'alpha', 'latest']:
        raise ValueError(f'env must be dev/alpha/latest. got: {env}')
    return env, package_name


def find_latest_version_in_npm(package_name, is_alpha=False):
    versions_output = run_cmd(
        ['npm', 'view', package_name, 'versions', '--json'],
        show_log=False)
    versions = json.loads(versions_output)
    versions = list(reversed(versions))
    def alpha_only_filter(x): return 'alpha' in x
    def non_alpha_filter(x): return 'alpha' not in x
    version_filter = alpha_only_filter if is_alpha else non_alpha_filter
    return next(ver for ver in versions if version_filter(ver))


def get_package_to_install(env, package_name):
    if env == 'dev':
        return f'{package_name}@*'
    elif env == 'alpha':
        ver = find_latest_version_in_npm(package_name, is_alpha=True)
        return f'{package_name}@{ver}'
    else:
        ver = find_latest_version_in_npm(package_name, is_alpha=False)
        return f'{package_name}@{ver}'


def main():
    env, package_name = get_env_arg()
    package_to_install = get_package_to_install(env, package_name)
    run_cmd(['npm', 'uninstall', package_name])
    run_cmd(['npm', 'cache', 'clean', '--force'])
    run_cmd(['npm', 'install', '--save-exact', package_to_install])
    print(f'✅ Installed {package_to_install}')


main()
