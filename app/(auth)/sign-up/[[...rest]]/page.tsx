import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        afterSignInUrl="/"
        afterSignUpUrl="/"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-sm border border-neutral-200",
          },
        }}
      />
    </div>
  );
}
