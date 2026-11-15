import React, { useLayoutEffect, useRef, useState } from 'react';
import { familyConnectorPaths, type FamilyNodeBounds } from '../utils/familyTreeConnections';

export function FamilyTreeConnections({ layoutKey }: { layoutKey: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState({ width: 0, height: 0, paths: [] as string[] });

  useLayoutEffect(() => {
    const tree = svgRef.current?.parentElement;
    if (!tree) return;
    let frame = 0;
    const measure = () => {
      const treeBox = tree.getBoundingClientRect();
      const width = tree.offsetWidth;
      const height = tree.offsetHeight;
      if (!treeBox.width || !treeBox.height || !width || !height) return;
      const scaleX = width / treeBox.width;
      const scaleY = height / treeBox.height;
      const bounds = (element: Element): FamilyNodeBounds => {
        const box = element.getBoundingClientRect();
        return { left: (box.left - treeBox.left) * scaleX, top: (box.top - treeBox.top) * scaleY,
          width: box.width * scaleX, height: box.height * scaleY };
      };
      const paths: string[] = [];
      for (const list of tree.querySelectorAll<HTMLUListElement>('.lexicon-family-branches')) {
        const parent = list.parentElement?.querySelector(':scope > .lexicon-family-node, :scope > .lexicon-family-base');
        if (!parent) continue;
        const childButtons = list.querySelectorAll<HTMLButtonElement>(':scope > .lexicon-family-branch > .lexicon-family-node');
        const children = Array.from<HTMLButtonElement, FamilyNodeBounds>(childButtons, bounds);
        paths.push(...familyConnectorPaths(bounds(parent), children, getComputedStyle(list).display === 'block'));
      }
      setDrawing(previous => previous.width === width && previous.height === height
        && previous.paths.join('|') === paths.join('|') ? previous : { width, height, paths });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(tree);
    tree.querySelectorAll('.lexicon-family-node, .lexicon-family-base').forEach(node => observer.observe(node));
    // Font loading can change branch positions without changing the tree's total width.
    document.fonts?.addEventListener('loadingdone', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [layoutKey]);

  return <svg ref={svgRef} className="lexicon-family-connections" viewBox={`0 0 ${drawing.width || 1} ${drawing.height || 1}`}
    aria-hidden="true" focusable="false">
    {drawing.paths.map((path, index) => <path key={index} d={path}/>)}
  </svg>;
}
