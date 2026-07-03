import { redirect } from 'next/navigation';

// The full address-first wizard now lives on the dashboard ("/") so there is a
// single, real-data-backed submission flow instead of two diverging copies.
export default function UploadRedirectPage() {
  redirect('/');
}
