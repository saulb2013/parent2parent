import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Born from a Parent's Frustration. Built for Every Parent's Wallet.
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="space-y-6 text-gray-600 leading-relaxed text-lg">
          <p>
            Every parent knows the feeling. You've just spent a small fortune on a gorgeous pram, a barely-used baby bouncer, or a wardrobe full of tiny clothes your little one wore twice before outgrowing overnight. Now it sits in the corner of the garage — too good to throw away, too specific to sell anywhere useful.
          </p>
          <p>
            Parent2Parent was born out of exactly that moment. As parents ourselves, we watched money walk out the door season after season. We searched for a place — a trusted, South African space — where parents could pass things on to other parents who actually need them. We couldn't find one. So we built it.
          </p>
          <p>
            This isn't just a marketplace. It's a community of parents helping parents. A mum in Cape Town passing her infant car seat to a first-time dad in Joburg. A toddler's barely-worn winter wardrobe finding new life in a Durban household. Real things. Real savings. Real people.
          </p>
          <p className="font-display text-xl md:text-2xl text-primary font-semibold italic">
            We believe that children outgrow things — not their worth. And we believe parents deserve a smarter, kinder way to buy and sell the things that matter most.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="btn-accent text-lg">
            Join Our Community
          </Link>
        </div>
      </section>
    </div>
  );
}
