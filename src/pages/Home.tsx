import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Armchair,
  ShieldCheck,
  Repeat,
  Search,
} from "lucide-react";
import { Button } from "../components/ui/button";
export function Home() {
  return (
    <>
      <section className="container-page grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="eyebrow">
            <span className="h-2 w-2 rounded-full bg-brand" />
            LESS SPENDING. MORE STUDENT LIFE.
          </p>
          <h1 className="mt-6 max-w-xl text-5xl font-bold leading-[1.1] tracking-[-.045em] sm:text-6xl">
            Your campus.
            <br />
            Your people.
            <br />
            <span className="text-brand">Your next great find.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
            From next semester’s books to a calculator for tomorrow. Buy, sell,
            rent and find what you need, right on campus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/marketplace">
                Explore the marketplace <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/post">List something</Link>
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-stone-500">
            <ShieldCheck size={18} className="text-brand" />
            University email verified. Campus connected.
          </p>
        </div>
        <div className="relative rounded-[2rem] bg-[#e9eddf] p-6 sm:p-9">
          <div className="mb-5 flex justify-between text-xs font-semibold uppercase tracking-widest text-brand">
            <span>The student essentials</span>
            <span>↗</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/marketplace?category=books-notes"
              className="essential bg-[#f4d59a] -rotate-3"
            >
              <BookOpen size={62} strokeWidth={1.1} />
              <span>
                Books with
                <br />a second chapter.
              </span>
              <ArrowUpRight className="self-end" />
            </Link>
            <Link
              to="/marketplace?category=calculators"
              className="essential mt-8 bg-[#cadcdd] rotate-3"
            >
              <Calculator size={62} strokeWidth={1.1} />
              <span>
                Big equations.
                <br />
                Smaller prices.
              </span>
              <ArrowUpRight className="self-end" />
            </Link>
            <Link
              to="/marketplace?category=hostel-room"
              className="col-span-2 flex items-center justify-between rounded-2xl bg-white p-6"
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  Pass it on
                </p>
                <p className="mt-2 text-xl font-semibold">
                  New room. Pre-loved things.
                </p>
              </div>
              <Armchair size={65} strokeWidth={1} />
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-stone-600">
            A little more reuse. A lot more possibility.
          </p>
        </div>
      </section>
      <section className="border-y bg-white">
        <div className="container-page grid gap-8 py-7 md:grid-cols-3">
          {[
            [
              ShieldCheck,
              "A campus you know",
              "Connect through verified university emails.",
            ],
            [
              Repeat,
              "Use more. Spend less.",
              "Give useful things their next student home.",
            ],
            [
              Search,
              "Find your people",
              "Discover listings, then arrange a campus meetup.",
            ],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={String(title)} className="flex gap-4">
                <I className="mt-1 shrink-0 text-brand" />
                <div>
                  <h2 className="font-semibold">{String(title)}</h2>
                  <p className="mt-1 text-sm text-stone-500">{String(text)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="container-page py-14">
        <p className="eyebrow">ONE CAMPUS. THREE WAYS TO EXCHANGE.</p>
        <div className="mt-4 flex flex-wrap justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tight">
            What brings you here?
          </h2>
          <Link
            to="/marketplace"
            className="flex items-center gap-2 text-sm font-semibold text-brand"
          >
            See what’s out there <ArrowRight size={17} />
          </Link>
        </div>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {[
            [
              "SALE",
              "01",
              "Buy & sell",
              "Great finds deserve another semester.",
            ],
            [
              "RENT",
              "02",
              "Borrow the possibility",
              "Need it for a day? Find a student rental.",
            ],
            [
              "REQUEST",
              "03",
              "Ask your campus",
              "Can’t find it? Let your campus know.",
            ],
          ].map(([type, n, title, text]) => (
            <Link
              key={type}
              to={`/marketplace?type=${type}`}
              className="rounded-2xl border bg-white p-7 hover:border-brand"
            >
              <span className="text-sm text-brand">{n} /</span>
              <h3 className="mt-7 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-stone-500">{text}</p>
              <ArrowUpRight className="mt-5 text-brand" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
