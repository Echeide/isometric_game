import { parseScene, type WorldScene, type WorldAdapter, type WorldInteraction } from '@isometrico/world';
import officeData from './maps/checkpoint.json';
import outdoorsData from './maps/routingtales.json';
export const office = parseScene(officeData);
export const outdoors = parseScene(outdoorsData);
/** Both hosts use the exact same engine. Only scene data and action routing change. */
export function makeAdapter(scene:WorldScene, open:(event:WorldInteraction)=>void):WorldAdapter {
  return {scene, interact(event){
    const entity=scene.entities.find(e=>e.id===event.entityId);
    if(event.sceneId!==scene.id||entity?.interaction?.action!==event.action||entity.interaction.resourceId!==event.resourceId) throw new Error('Unknown world interaction');
    open(event);
  }};
}
export type Task={id:string;title:string;description:string;status:'todo'|'active'|'done';tag:string};
export const initialTasks:Task[]=[
 {id:'brief',title:'Definir el alcance del proyecto',description:'Revisar los objetivos de Atlas y acordar los entregables de la primera fase.',status:'done',tag:'Planificación'},
 {id:'flow',title:'Diseñar el flujo de bienvenida',description:'Dibujar el recorrido desde la primera visita hasta la creación del primer espacio de trabajo.',status:'todo',tag:'Diseño'},
 {id:'review',title:'Revisar los componentes',description:'Comprobar los estados de botones, formularios y navegación con el equipo.',status:'todo',tag:'Producto'},
];
export const initialGoals=[
 {id:'start',title:'El punto de partida',description:'Define tu intención para esta ruta. ¿Qué te gustaría haber conseguido al llegar al final?',done:false},
 {id:'forest',title:'Explorar el bosque',description:'Encuentra tres ideas que te ayuden a avanzar. Anota lo que has aprendido antes de continuar.',done:false},
 {id:'summit',title:'Llegar a la cima',description:'Completa tu recorrido y revisa lo conseguido. Cada paso cuenta.',done:false}
];
