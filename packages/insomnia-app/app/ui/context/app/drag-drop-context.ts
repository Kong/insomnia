import { DragDropContext } from 'react-dnd';
import DNDBackend from '../../dnd-backend';
// @ts-expect-error -- TSCONVERSION
export default DragDropContext(DNDBackend);
