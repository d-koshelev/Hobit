use hobit_storage_sqlite::{NewWorkspaceNote, WorkspaceNoteUpdate};

use crate::WorkspaceServiceError;

use super::{
    mapping::workspace_note_summary, placeholder_id, placeholder_timestamp,
    validation::required_input, CreateWorkspaceNoteInput, UpdateWorkspaceNoteInput,
    WorkspaceNoteSummary, WorkspaceService,
};

impl WorkspaceService {
    pub fn create_workspace_note(
        &self,
        input: CreateWorkspaceNoteInput,
    ) -> Result<WorkspaceNoteSummary, WorkspaceServiceError> {
        let input = normalize_create_note_input(input)?;
        let note_id = placeholder_id("note_");
        let created_at = placeholder_timestamp();

        let note = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                let note = store.create_note(NewWorkspaceNote {
                    note_id: &note_id,
                    workspace_id: &input.workspace_id,
                    title: &input.title,
                    body: &input.body,
                    pinned: input.pinned,
                    archived: false,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(note)
            })
            .map_err(map_storage_note_error)?;

        Ok(workspace_note_summary(note))
    }

    pub fn list_workspace_notes(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<WorkspaceNoteSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_notes_for_workspace(workspace_id)?
            .into_iter()
            .map(workspace_note_summary)
            .collect())
    }

    pub fn get_workspace_note(
        &self,
        workspace_id: &str,
        note_id: &str,
    ) -> Result<Option<WorkspaceNoteSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let note_id = required_input(note_id, "note id")?;

        self.validate_note_workspace_access(workspace_id, note_id)?;
        Ok(self
            .store
            .get_note(workspace_id, note_id)?
            .map(workspace_note_summary))
    }

    pub fn update_workspace_note(
        &self,
        input: UpdateWorkspaceNoteInput,
    ) -> Result<Option<WorkspaceNoteSummary>, WorkspaceServiceError> {
        let input = normalize_update_note_input(input)?;
        self.validate_note_workspace_access(&input.workspace_id, &input.note_id)?;

        let updated_at = placeholder_timestamp();
        let note = self.store.with_immediate_transaction(|store| {
            let note = store.update_note(
                &input.workspace_id,
                &input.note_id,
                WorkspaceNoteUpdate {
                    title: &input.title,
                    body: &input.body,
                    pinned: input.pinned,
                    updated_at: Some(&updated_at),
                },
            )?;
            if note.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(note)
        })?;

        Ok(note.map(workspace_note_summary))
    }

    fn validate_note_workspace_access(
        &self,
        workspace_id: &str,
        note_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(note) = self.store.get_note_by_id(note_id)? else {
            return Ok(());
        };

        if note.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "note does not belong to workspace: {note_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedCreateNoteInput {
    workspace_id: String,
    title: String,
    body: String,
    pinned: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateNoteInput {
    workspace_id: String,
    note_id: String,
    title: String,
    body: String,
    pinned: bool,
}

fn normalize_create_note_input(
    input: CreateWorkspaceNoteInput,
) -> Result<NormalizedCreateNoteInput, WorkspaceServiceError> {
    Ok(NormalizedCreateNoteInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        title: required_owned(input.title, "note title")?,
        body: input.body,
        pinned: input.pinned,
    })
}

fn normalize_update_note_input(
    input: UpdateWorkspaceNoteInput,
) -> Result<NormalizedUpdateNoteInput, WorkspaceServiceError> {
    Ok(NormalizedUpdateNoteInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        note_id: required_owned(input.note_id, "note id")?,
        title: required_owned(input.title, "note title")?,
        body: input.body,
        pinned: input.pinned,
    })
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn map_storage_note_error(error: hobit_storage_sqlite::StorageError) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
