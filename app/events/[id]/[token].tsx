// app/events/[id]/[token].tsx
import { useRouter } from 'next/router';

export default function ConfirmEvent() {
  const router = useRouter();
  const { id, token } = router.query; // Get 'id' and 'token' from the URL

  return (
    <div>
      <h1>Event Confirmation</h1>
      <p>Confirming event with ID: {id} and token: {token}</p>
      {/* You can add more logic here to verify the token and confirm the event */}
    </div>
  );
}

