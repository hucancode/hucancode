'use client';
import { useRouter } from 'next/navigation';

export default function Home({ lang }) {
  const router = useRouter();
  router.push('/en');
  return <></>
}
