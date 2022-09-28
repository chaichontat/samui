<script lang="ts">
  import { sFeatureData, sId } from '$lib/store';
  import { oneLRU } from '$src/lib/lru';
  import * as Plot from '@observablehq/plot';
  // import Chart from 'chart.js/auto';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  let div: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let subdiv: Element | undefined;

  const tooltip = (Plot) => {
    class Tooltip extends Plot.Mark {
      constructor(
        data,
        {
          x,
          y,
          z,
          stroke = 'black',
          fill = 'none',
          r = 4,
          content = (d) => d,
          direction = 'down',
          tx,
          ty,
          dx = 0,
          dy = 0,
          onclick,
          onmouseover,
          annotate,
          ...options
        } = {}
      ) {
        super(
          data,
          [
            { name: 'x', value: x, scale: 'x', optional: true },
            { name: 'y', value: y, scale: 'y', optional: true },
            { name: 'z', value: z, optional: true },
            { name: 'content', value: content }
          ],
          options
        );

        this.r = r;
        this.fill = fill;
        this.stroke = stroke;
        this.annotate = annotate;
        this.direction = direction;
        this.tx = tx;
        this.ty = ty;
        this.dx = dx;
        this.dy = dy;
        this.onclick = onclick;
        this.onmouseover = onmouseover;
      }
      render(
        index,
        scales,
        { x: X, y: Y, z: Z, content: T },
        { width, height, marginTop, marginRight, marginBottom, marginLeft }
      ) {
        const {
          r,
          stroke,
          fill,
          annotate,
          direction,
          tx,
          ty,
          dx,
          dy,
          onclick,
          onmouseover,
          formatter
        } = this;
        const x = X ? (i) => X[i] : constant((marginLeft + width - marginRight) / 2);
        const y = Y ? (i) => Y[i] : constant((marginTop + height - marginBottom) / 2);

        const quadtree = d3
          .quadtree()
          .x(x)
          .y(y)
          .addAll(index.filter((i) => x(i) !== undefined && y(i) !== undefined));

        const g = d3.create('svg:g');
        const highlights = g.append('g');

        let frozen = -1; // freeze the tooltip on click

        const catcher = g
          .append('rect')
          .attr('height', height)
          .attr('width', width)
          .style('fill', 'none')
          .attr('pointer-events', 'all')
          .on('pointerenter', () => {})
          .on('pointerout', (event) => frozen === -1 && hide())
          .on('pointermove', move);

        catcher.on('click', (event) => {
          const i = find(event);
          if (frozen > -1 && i > -1 && i !== frozen) {
            show((frozen = i));
          } else {
            frozen = frozen === -1 ? i : -1;
          }
          if (typeof onclick === 'function' && i >= 0) onclick(event, i, g.node());
        });

        function find(event) {
          const p = d3.pointers(event)[0],
            i = quadtree.find(...p);
          if (Math.hypot(p[0] - x(i), p[1] - y(i)) < 30) return i;
          return -1;
        }

        function move(event) {
          if (frozen > -1) return;
          const i = find(event);
          if (i > -1) {
            show(i);
            if (typeof onmouseover === 'function') {
              onmouseover(event, i, g.node());
            }
          } else hide();
        }

        let tooltip;
        let xy;
        hide();

        return g.node();

        function show(i) {
          highlights
            .selectAll('circle')
            .data(index.filter((j) => i === j || (Z && Z[i] === Z[j])))
            .join('circle')
            .attr('r', r)
            .style('fill', fill)
            .style('stroke', stroke)
            .attr('cx', x)
            .attr('cy', y);

          tooltip &&
            tooltip.call(callout, {
              formatter,
              direction,
              text: T[i],
              x: tx === undefined ? x(i) : tx,
              y: ty === undefined ? y(i) : ty,
              transform: xy,
              dx,
              dy
            });
        }

        function hide() {
          tooltip && tooltip.call(callout);
          highlights.html('');

          if (annotate !== undefined && index.includes(annotate)) {
            setTimeout(() => show(annotate), 200);
          }
        }
      }
    }

    return function tooltip(data, options) {
      return new Tooltip(data, options);
    };

    function constant(x) {
      return () => x;
    }
  };

  // let chart: Chart;

  // onMount(() => {
  //   chart = new Chart(canvas, {
  //     type: 'bar',
  //     data: { labels: [], datasets: [] },
  //     options: {
  //       responsive: false,
  //       animation: false,
  //       // parsing: false,
  //       plugins: { legend: { display: false } },
  //       scales: {
  //         x: { grid: { display: false } },
  //         y: { grid: { drawBorder: false, color: '#ffffff55', lineWidth: 0.5 } }
  //       }
  //     }
  //   });
  // });

  const updatePlot = oneLRU((name: any) => {
    if (subdiv) {
      div.removeChild(subdiv);
    }

    // const data = $sFeatureData.data;

    // const binned = d3.bin()(data as number[]);
    // const label = [];
    // const b = [];

    // for (let i = 0; i < binned.length; i++) {
    //   label.push(binned[i].x0);
    //   b.push(binned[i].length);
    // }

    // chart.data = {
    //   labels: label,
    //   datasets: [{ data: b, borderWidth: 0, backgroundColor: '#fde68a' }]
    // };
    // chart.update();
    // console.log(b);
    const n = $sFeatureData.data[$sId.idx!];

    subdiv = Plot.plot({
      x: { label: $sFeatureData.unit ?? '' },
      y: {
        // percent: true,
        grid: true
      },
      color: {
        interpolate: d3.interpolateTurbo,
        domain: [0, 10]
      },
      marks: [
        Plot.rectY(
          $sFeatureData.data.map((x) => ({ value: x })),
          Plot.binX(
            { y: 'count', fill: 'median' },
            { x: 'value', thresholds: 'sturges', fill: 'value' }
          )
        ),
        Plot.ruleY([0]),
        tooltip(Plot)(
          $sFeatureData.data.map((x) => ({ value: x })),
          Plot.binX(
            { y: 'count', fill: 'median' },
            { x: 'value', thresholds: 'sturges', fill: 'value' }
          )
        )
      ],
      marginLeft: 40,
      marginTop: 35,
      marginBottom: 30,
      style: {
        background: 'transparent',
        fontSize: '18px'
      }
    });

    const another = Plot.plot({
      x: { label: $sFeatureData.unit ?? '' },
      y: {
        // percent: true,
        grid: true
      },
      marks: [
        Plot.link(
          [
            { x1: n, y1: 300, x2: n, y2: 50 }
            //   { x: 5, y: 300 }
          ],
          {
            x1: 'x1',
            y1: 'y1',
            x2: 'x2',
            y2: 'y2',
            stroke: '#f97316',
            strokeWidth: 3,
            markerEnd: 'arrow'
          }
        )
      ],
      marginLeft: 40,
      marginTop: 35,
      marginBottom: 30,
      style: {
        background: 'transparent',
        fontSize: '18px'
      }
    });

    const x = Plot.rectY(
      $sFeatureData.data.map((x) => ({ value: x })),
      Plot.binX(
        { y: 'count', fill: 'median' },
        { x: 'value', thresholds: 'sturges', fill: 'value' }
      )
    );

    console.log(x);

    another.classList.add('absolute', 'top-0', 'left-0');

    div.appendChild(subdiv);
    // div.appendChild(another);
  });

  $: if (div && $sId.idx != undefined && $sFeatureData && $sFeatureData.dataType !== 'singular') {
    updatePlot($sFeatureData.name);
  }
</script>

<div bind:this={div} class="relative overflow-visible p-2" />
<!-- <canvas bind:this={canvas} class="mr-2 -ml-2 -mt-2" /> -->
