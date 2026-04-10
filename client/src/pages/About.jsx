import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Built for parents. Designed for real life.
          </h1>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="space-y-6 text-gray-600 leading-relaxed text-lg">
          <p>
            Every parent knows the cycle. You buy something your child needs, and a few months later, they've outgrown it. It is still in great condition, still valuable, just no longer useful to you.
          </p>
          <p>
            We wanted a place that felt safe, simple, and truly made for parents. So we built one.
          </p>
          <p>
            Parent2Parent is more than a marketplace. It is a place where parents can pass on what is still good to someone who actually needs it. A mom in Cape Town passing on a car seat to a first-time dad in Johannesburg. A toddler's wardrobe finding a new home in Durban. Real things. Real savings. Real parents.
          </p>
          <p>
            What makes Parent2Parent different is trust. We are building a parent-to-parent marketplace with safety-guided listings, clear condition standards, and a simpler way to buy and sell locally. Because when it comes to baby and kids' products, parents want more than convenience — they want confidence.
          </p>
          <p className="font-display text-xl md:text-2xl text-primary font-semibold italic">
            We believe children outgrow things, not their value. And we believe parents deserve a smarter, safer way to buy and sell the things that matter most.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link to="/register" className="btn-accent text-lg">
            Join Our Community
          </Link>
        </div>
      </section>
    </div>
  );
}
