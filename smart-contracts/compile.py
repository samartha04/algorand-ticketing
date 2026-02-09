import os
import subprocess
import sys

def compile_contract(filename):
    print(f"Compiling {filename}...")
    subprocess.run([sys.executable, filename], check=True)

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    contracts = ["ticket_manager.py", "event_factory.py"]
    
    for contract in contracts:
        path = os.path.join(current_dir, contract)
        if os.path.exists(path):
            compile_contract(path)
            print(f"Successfully compiled {contract}")
        else:
            print(f"Error: {contract} not found at {path}")
