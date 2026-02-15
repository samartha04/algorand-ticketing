import os
import subprocess
import sys
import shutil

def compile_contract(filename, contract_name):
    print(f"Compiling {filename}...")
    subprocess.run([sys.executable, filename], check=True, cwd=os.path.dirname(filename))
    
    # Copy artifacts to frontend
    source_dir = os.path.dirname(filename)
    target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "utils", "contracts"))
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        
    artifacts = [
        f"{contract_name}_approval.teal",
        f"{contract_name}_clear.teal",
        f"{contract_name}_contract.json"
    ]
    
    for artifact in artifacts:
        source_path = os.path.join(source_dir, artifact)
        if os.path.exists(source_path):
            shutil.copy2(source_path, target_dir)
            print(f"Copied {artifact} to frontend")
        else:
            print(f"Warning: {artifact} not found in {source_dir}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    contracts = [
        ("algokit_contracts/ticket_manager.py", "ticket_manager"),
        ("algokit_contracts/event_factory.py", "event_factory")
    ]
    
    for relative_path, name in contracts:
        path = os.path.join(current_dir, relative_path)
        if os.path.exists(path):
            compile_contract(path, name)
            print(f"Successfully compiled and deployed {name}")
        else:
            print(f"Error: {relative_path} not found at {path}")
