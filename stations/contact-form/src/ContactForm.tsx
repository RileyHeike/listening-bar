import { StationBoundary } from '@bar/room';
import { Button } from '@bar/ui';
import type { ReactNode, SubmitEvent } from 'react';
import { useState } from 'react';

/**
 * UI only: the form validates and acknowledges, but sends nothing. Sending
 * needs a write route, which waits on the open admin-auth decision.
 */
type Errors = Partial<Record<'name' | 'email' | 'message', string>>;

function validate(data: FormData): Errors {
  const errors: Errors = {};
  const value = (key: string) => {
    const raw = data.get(key);
    return typeof raw === 'string' ? raw.trim() : '';
  };
  if (!value('name')) errors.name = 'Add your name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value('email')))
    errors.email = 'Add an email address I can reply to.';
  if (value('message').length < 10)
    errors.message = 'Write a little more (at least 10 characters).';
  return errors;
}

function Form({
  onSubmit,
  errors = {},
  sent = false,
}: {
  onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void;
  errors?: Errors;
  sent?: boolean;
}) {
  const field = (name: keyof Errors, label: string, input: ReactNode) => (
    <div className="contact__field" data-invalid={errors[name] ? '' : undefined}>
      <label htmlFor={`contact-${name}`}>{label}</label>
      {input}
      <p id={`contact-${name}-error`} className="contact__error" aria-live="polite">
        {errors[name] ?? ''}
      </p>
    </div>
  );
  const describedBy = (name: keyof Errors) => (errors[name] ? `contact-${name}-error` : undefined);
  return (
    <form className="contact__form" noValidate onSubmit={onSubmit}>
      {field(
        'name',
        'Name',
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          aria-describedby={describedBy('name')}
        />,
      )}
      {field(
        'email',
        'Email',
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={describedBy('email')}
        />,
      )}
      {field(
        'message',
        'Message',
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          aria-invalid={!!errors.message}
          aria-describedby={describedBy('message')}
        />,
      )}
      <div className="contact__submit">
        <Button type="submit">Leave the note</Button>
        <p className="contact__status" role="status">
          {sent ? "Thanks. This form isn't connected yet, so nothing was sent." : ''}
        </p>
      </div>
    </form>
  );
}

function Live() {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  return (
    <Form
      errors={errors}
      sent={sent}
      onSubmit={(event) => {
        event.preventDefault();
        const found = validate(new FormData(event.currentTarget));
        setErrors(found);
        setSent(Object.keys(found).length === 0);
      }}
    />
  );
}

export default function ContactForm() {
  return (
    <StationBoundary station="contact-form" fallback={<Form />}>
      <Live />
    </StationBoundary>
  );
}

export { validate };
