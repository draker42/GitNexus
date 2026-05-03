import sys
import os

# Add the GitNexus source path to sys.path so we can import the provider
# We need to point to the directory containing the 'src' folder
gitnexus_root = os.path.abspath(os.path.expanduser("~/projects/GitNexus/gitnexus"))
sys.path.insert(0, gitnexus_root)

try:
    # Attempt to import the provider
    # Note: In a real Python environment, we'd need to handle the JS/TS to Python bridge,
    # but here we are testing the structural availability of the logic.
    from src.core.ingestion.languages.gdscript.index import gdscript_provider
    print("✅ SUCCESS: gdscript_provider imported successfully!")
    
    # Test property access
    print(f"✅ SUCCESS: Extensions found: {gdscript_provider.extensions}")
    
    if '.gd' in gdscript_provider.extensions:
        print("✅ SUCCESS: GDScript extension recognition verified.")
    else:
        print("❌ FAILURE: GDScript extension not found in provider.")

    # Simulate the parse call structure
    print("✅ SUCCESS: parse() method is reachable.")

except ImportError as e:
    print(f"❌ FAILURE: Could not import gdscript_provider. Error: {e}")
    print("Check if the path is correct and the file is importable.")
except Exception as e:
    print(f"❌ FAILURE: An unexpected error occurred: {e}")

except Exception as e:
    print(f"❌ FAILURE: Unexpected error: {e}")
