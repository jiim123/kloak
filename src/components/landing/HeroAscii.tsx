"use client";

import React from "react";

export default function HeroAsciiModern({ image = "/hero.jpg", alt = "Hero image" }) {
  const codeText = [
    '"use client";',
    "",
    'import { useEffect } from "react";',
    'import { Link } from "react-router-dom";',
    'import { Heatmap } from "@paper-design/shaders-react";',
    "",
    "export default function HeroAscii() {",
    "  useEffect(() => {",
    '    const embedScript = document.createElement("script");',
    '    embedScript.type = "text/javascript";',
    "    embedScript.textContent = `",
    "      !function(){",
    "        if(!window.UnicornStudio){",
    "          window.UnicornStudio={isInitialized:!1};",
    '          var i=document.createElement("script");',
    '          i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.33/dist/unicornStudio.umd.js";',
    "          i.onload=function(){",
    "            window.UnicornStudio.isInitialized ||",
    "            (UnicornStudio.init(), window.UnicornStudio.isInitialized=!0)",
    "          };",
    "          (document.head || document.body).appendChild(i)",
    "        }",
    "      }();",
    "    `;",
    "",
    "    document.head.appendChild(embedScript);",
    "  }, []);",
    "",
    "  return (",
    "    <section>...</section>",
    "  );",
    "}",
  ].join("\n");

  return (
    <section className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-6xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden shadow-none">
          {/* Large image with rounded corners */}
          <img
            src={image}
            alt={alt}
            className="w-full h-[min(70vh,900px)] object-cover block"
            loading="lazy"
            aria-hidden={false}
          />

          {/* Gradient overlay from the bottom (above the image) */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          </div>

          {/* Bottom-left text (no shadows) */}
          <div className="absolute left-6 bottom-6 sm:left-8 sm:bottom-8 md:left-12 md:bottom-12 max-w-[72%]">
            <div className="backdrop-blur-sm bg-black/30 rounded-lg p-4 sm:p-6" style={{ boxShadow: "none" }}>
              <pre
                className="whitespace-pre-wrap font-mono text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed text-white m-0"
                style={{ textShadow: "none" }}
                aria-label="Hero code text"
              >
                {codeText}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
