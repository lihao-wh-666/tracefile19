
import subprocess
import sys

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr

def main():
    # 1. 获取当前提交历史
    _, log, _ = run_cmd('git log --pretty=format:"%H %s" -4')
    print("Current commits:")
    print(log)
    print()
    
    # 2. 我们需要重写的提交是 aac8c1a
    target_hash = "aac8c1a64d254a2054c21caf28e11d17259a23bc"
    new_msg = ".4056566457176777:0c534bef1e004a5c05c0c368cf77abd8_6a22a232f31f4056d2d804a0.6a22a272f31f4056d2d804a5.6a22a2720c10426fc58fff1f:Trae CN.T(2026/6/5 18:18:26)"
    
    # 3. 重置到 Initial commit
    print("Resetting to Initial commit...")
    run_cmd('git reset --hard 4a20f39236b71697747bff8d0fc465c715fda7f0')
    
    # 4. Cherry-pick aac8c1a 并修改 message
    print("Cherry-picking aac8c1a with new message...")
    # 首先获取这个提交的内容
    _, tree, _ = run_cmd(f'git show -s --format=%T {target_hash}')
    tree = tree.strip()
    
    # 获取父提交
    _, parent, _ = run_cmd(f'git show -s --format=%P {target_hash}')
    parent = parent.strip()
    
    # 获取作者和提交者信息
    _, author, _ = run_cmd(f'git show -s --format=%an {target_hash}')
    author = author.strip()
    _, author_email, _ = run_cmd(f'git show -s --format=%ae {target_hash}')
    author_email = author_email.strip()
    _, author_date, _ = run_cmd(f'git show -s --format=%ad {target_hash}')
    author_date = author_date.strip()
    
    # 使用 commit-tree 创建新提交
    cmd = f'git commit-tree -m "{new_msg}" -p {parent} {tree}'
    _, new_hash, _ = run_cmd(cmd)
    new_hash = new_hash.strip()
    print(f"Created new commit: {new_hash}")
    
    # 更新 HEAD
    run_cmd(f'git reset --hard {new_hash}')
    
    # 5. Cherry-pick 49134fc
    print("Cherry-picking 49134fc...")
    code, _, err = run_cmd('git cherry-pick 49134fc0f27dc9a8f9a0aa81a7ade157616c4701')
    if code != 0:
        print("Cherry-pick 49134fc failed:", err)
        return
    
    # 6. Cherry-pick de5641c
    print("Cherry-picking de5641c...")
    code, _, err = run_cmd('git cherry-pick de5641c38422d9dbfa760f8f05d2dc00dada858e')
    if code != 0:
        print("Cherry-pick de5641c failed:", err)
        return
    
    print()
    print("Done! New commit history:")
    _, new_log, _ = run_cmd('git log --pretty=format:"%H %s" -4')
    print(new_log)

if __name__ == "__main__":
    main()

