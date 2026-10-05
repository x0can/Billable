import { Field } from './ui';

type ProjectDefaults = {
  name?: string;
  hourly_rate?: number;
  budget_hours?: number | null;
  start_date?: string | null;
  end_date?: string | null;
};

/** Shared fields for creating and editing a project. Wrap in a <form> with the right action. */
export function ProjectForm({ project = {} }: { project?: ProjectDefaults }) {
  return (
    <>
      <Field label="Project name" name="name" defaultValue={project.name} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hourly rate ($)" name="hourly_rate" type="number" min={0} step="0.01" defaultValue={project.hourly_rate} required />
        <Field label="Budget (hours)" name="budget_hours" type="number" min={0.01} step="0.01" defaultValue={project.budget_hours ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" name="start_date" type="date" defaultValue={project.start_date ?? ''} />
        <Field label="End date" name="end_date" type="date" defaultValue={project.end_date ?? ''} />
      </div>
    </>
  );
}
