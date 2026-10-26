# Deliberation-lane spine usage, current docs only

This file records which entries from the shared deliberation schema each
current documentation artifact actually uses. It is not a spec. It is a
read-back, so missing rows are intentional gaps.

current_workspace_root:
  local: C:\\Users\\ajaba\\Downloads\\neuron\\NeuronVS_port
  bank:  C:\\Users\\ajaba\\Downloads\\neuron\\NeuronVS-db\\NeuronDB
  fragment_form: "model folder, scape/sphere, map.script, sound.script"

deliberation_root:
  path: docs/deliberation
  spine_file: deliberation.json
  meta_file:  deliberation_meta.json
  gcell_file: deliberation_gcell_registry.json

spine_entries_used_by_current_docs:
  - name: job
    referenced_by: "this file and any GENESIS/SCAN flow notes"
    fields_used:
      - source
      - mode
      - phase
      - verdict
      - created_at
  - name: signal
    referenced_by: "session evidence flow"
    fields_used:
      - sig_id
      - sig_type
      - payload_shape
      - parent_job
      - status
      - verified
  - name: scan_layer
    referenced_by: "NeuronVS format dissection notes"
    fields_used:
      - layer_id
      - layer_type
      - owner
      - status
      - artifact_path
      - notes
  - name: amplification
    referenced_by: "preset / synth layer notes when they reference clearer delivery of a result"
    fields_used:
      - signal_id
      - stage_id
      - applied
      - method
      - notes
  - name: mindcode_entry
    referenced_by: "any note that treats a chunk of NeuronVS knowledge as a portable code block"
    fields_used:
      - entry_id
      - entry_type
      - digest
      - body_ref
      - confidence
      - scope
  - name: gcell_registry
    referenced_by: "if a doc points at a global cell for context handoff"
    fields_used:
      - cell_id
      - cell_type
      - owner
      - access
      - fingerprint
      - created_at
  - name: gcell_content
    referenced_by: "if a doc reads or writes the contents of one global cell"
    fields_used:
      - cell_id
      - content_type
      - content

entries_with_no_current_doc_coverage:
  - name: job
    gap: "no current doc creates or sequences multi-step NeuronVS jobs against this spine; only ad-hoc scripts exist"
  - name: signal
    gap: "no current doc emits a finished signal with a verdict other than 'watching' or 'in progress'"
  - name: scan_layer
    gap: "partial - format layers are described, but not always filed back as spine layers with status and artifact_path"
  - name: amplification
    gap: "mostly unused in existing docs; clearer guidance about what gets amplified is missing"
  - name: mindcode_entry
    gap: "partially used informally, but not filed through the spine schema with digest and scope"
  - name: gcell_registry
    gap: "not used by current NeuronVS docs at all"
  - name: gcell_content
    gap: "not used by current NeuronVS docs at all"

notes:
  - The NeuronVS port itself is documented mainly as C++ headers and scripts. This
    registry is the layer that would track which parts of a larger collaboration
    spine those docs actually occupy.
  - If a doc only describes bytes and file layout, it should still file the
    relevant scan_layer entry and record artifact_path, so later readers can tell
    what was verified against real files.
  - If a doc only speculates, it should use verdict or confidence rather than
    implying completion.
