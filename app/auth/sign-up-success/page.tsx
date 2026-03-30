'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, Gamepad2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpSuccessContent() {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const isWorldRedirect = returnTo?.startsWith('/world')

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent you a confirmation link. Please check your email to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              After confirming your email, you can log in and join the multiplayer world.
            </p>
            <Link href={`/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>
              <Button className="w-full">
                {isWorldRedirect && <Gamepad2 className="mr-2 h-4 w-4" />}
                {isWorldRedirect ? 'Log in to Join World' : 'Back to Login'}
              </Button>
            </Link>
            <Link href="/" className="text-center">
              <span className="text-sm text-muted-foreground hover:underline">Back to home</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SignUpSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center">Loading...</div>}>
      <SignUpSuccessContent />
    </Suspense>
  )
}
