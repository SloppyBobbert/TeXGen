FROM scratch

COPY --chmod=0555 tectonic /compiler/tectonic
COPY --chmod=0444 bundle.zip /assets/bundle.zip
COPY --chmod=0444 latex-33.fmt /assets/formats/Tectonic/formats/6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c-latex-33.fmt

ENV HOME=/scratch XDG_CACHE_HOME=/assets/formats
USER 10001:10001
WORKDIR /scratch
ENTRYPOINT ["/compiler/tectonic"]
CMD ["--version"]
