"""Package a validated buildless Sites application without including source secrets."""
import json,pathlib,tarfile
root=pathlib.Path(__file__).resolve().parent.parent
manifest=root/'.openai/hosting.json'
config=json.loads(manifest.read_text(encoding='utf-8'))
assert config['static']['directory']=='dist'
assert (root/'dist/index.html').is_file()
archive=root/'site.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 tar.add(manifest,arcname='.openai/hosting.json')
 tar.add(root/'dist',arcname='dist')
with tarfile.open(archive,'r:gz') as tar:
 names=set(tar.getnames())
 assert '.openai/hosting.json' in names and 'dist/index.html' in names
print(archive)