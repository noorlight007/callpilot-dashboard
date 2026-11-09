'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { jigsaw, type Contact } from '@/services/jigsaw-service';

interface DeleteContactButtonProps {
  contact: Pick<Contact, 'uid' | 'name'>;
  onDeleted: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
}

/** The API removes the local directory entry while retaining linked history. */
export function DeleteContactButton({ contact, onDeleted, disabled = false, iconOnly = true }: DeleteContactButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const changeOpen = (next: boolean) => {
    if (inFlight.current) return;
    if (next) setError('');
    setOpen(next);
  };
  const remove = async (event: MouseEvent<HTMLButtonElement>) => {
    // Keep the alert open until the server confirms the deletion.
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      await jigsaw(`contacts/${encodeURIComponent(contact.uid)}/`, 'DELETE');
      setOpen(false);
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to delete this contact. Try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return <AlertDialog open={open} onOpenChange={changeOpen}>
    <AlertDialogTrigger asChild>
      <button type="button" className="jigsaw-btn" style={{ color: "#b42318" }} disabled={disabled || pending} aria-label={`Delete ${contact.name}`} title={`Delete ${contact.name}`}>
        <Trash2 size={15} />{!iconOnly && 'Delete contact'}
      </button>
    </AlertDialogTrigger>
    <AlertDialogContent className="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle className="break-words">Delete {contact.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the contact from CallPilot. Existing call, message and document history is kept. The connected ATS record stays unchanged, and future syncs will not restore this contact.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={remove} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {pending ? <><Loader2 size={15} className="animate-spin" /> Deleting…</> : 'Delete contact'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
