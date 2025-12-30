import Link from "next/link";
import Image from "next/image";

export function ArbiterLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400 text-black">
        <Image
          src="/arbiter-mark.svg"
          alt=""
          width={18}
          height={18}
          className="dark:invert"
          priority
        />
      </span>
      <span className="text-lg font-semibold tracking-tight text-black dark:text-white">
        ARBITER
      </span>
    </Link>
  );
}
