export default async function TestFrame() {
  return (
    // Test 3 ds payment confirmation page
    <main className="p-4">
      <h1 className="text-xl">3DS Payment Confirmation Page</h1>

      <p className="my-3 mb-8">This is a test page for 3DS payment confirmation.</p>
      <a
        href={'http://localhost:3030/app/3ds-return/success/'}
        className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2 px-4 rounded-lg"
      >
        Confirm Payment
      </a>
    </main>
  );
}
