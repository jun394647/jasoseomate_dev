"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, Button } from "@/components/ui";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  return (
    <Card className="p-8 w-full max-w-sm text-center">
      <p className="text-lg font-semibold text-[#0b0b0b] dark:text-white mb-1">자소서메이트</p>
      <p className="text-sm text-[#898781] mb-6">나만의 자기소개서 작성 도우미</p>
      <Button className="w-full justify-center" onClick={() => signIn("google", { callbackUrl })}>
        Google로 계속하기
      </Button>
    </Card>
  );
}
