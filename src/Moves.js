import { getScreenWidth } from "./App.js";
import { TUtil } from "./TUtil.js"

/**
 * It offers utility functions for common movement patterns. They generate 
 * a list of numbers that serve as target values, which can be iterated through
 * using the steps, interval, and loop features of targets
 */
class Moves {
    static shakeMap = {};
    
    static bounce(from, to, { 
            yStart = undefined,
            xStart = getScreenWidth() / 2, 
            widthStart = 50, 
            heightStart = 50, 
            bFactor = 0.6, 
            cFactor = 0.2, 
            rotationStart = 0, 
            rIncrement = 360 
        } = {}) 
    {
        let bounce = Math.max(10, (to - from) * bFactor);        
        const ys = TUtil.isDefined(yStart) ? [yStart, from] : [from];
        const xs = [xStart];
        const widths = [widthStart];
        const heights = [heightStart];
        const rotations = [rotationStart];
        
        while (Math.abs(bounce | 0) > 1) {
            ys.push(to);
            ys.push(to - bounce);
            
            const compressedWidth = widthStart * (1 + cFactor);
            const compressedHeight = heightStart * (1 - cFactor);

            widths.push(compressedWidth);
            widths.push(widthStart);

            heights.push(compressedHeight);
            heights.push(heightStart);

            xs.push(xStart - (compressedWidth - widthStart) / 2);
            xs.push(xStart);

            rotations.push((rotations[rotations.length - 1] + rIncrement));

            bounce *= bFactor;
            rIncrement *= 0.8;
            cFactor *= bFactor;
        }
        
        xs.push(xStart);
        ys.push(to);
        widths.push(widthStart);
        heights.push(heightStart);
        
        const lastRotation = rotations[rotations.length - 1] % 360;
        if (lastRotation > 0 && lastRotation < 360) {
           rotations.push(360); 
        }

        return { 
            x: { list: xs }, 
            y: { list: ys },
            width: { list: widths }, 
            height: { list: heights }, 
            rotate: { list: rotations }
        };
    }
       
    static bounceSimple(tmodel, {
            from = undefined,
            to = undefined,
            widthStart = undefined,
            heightStart = undefined,
            xStart = undefined,
            yStart = undefined,
            bFactor = 0.5,
            cFactor = 0.7
        } = {}) 
    {
        from = TUtil.isDefined(from) ? from : tmodel.getY() - 70;
        to = TUtil.isDefined(to) ? to : tmodel.getY();
        widthStart = TUtil.isDefined(widthStart) ? widthStart : tmodel.getWidth();
        heightStart = TUtil.isDefined(heightStart) ? heightStart : tmodel.getHeight();
                
        yStart = TUtil.isDefined(yStart) ? yStart : tmodel.getY();
        xStart = TUtil.isDefined(xStart) ? xStart : tmodel.getX();
        
        const rIncrement = 0;
        
        const bounce = Moves.bounce(from, to, {
            yStart, xStart, widthStart, heightStart, bFactor, cFactor, rIncrement
        });
                
        return bounce;
    }
    
    static shake(tmodel, width = tmodel.getWidth(), height = tmodel.getHeight(), {
            bFactor = 0.6, 
            cFactor = 0.3,
            strength = 20
        } = {}) 
    {
        const xStart = (tmodel.getParentValue('width') - width) / 2;
        const yStart = tmodel.getY();            
        const widthStart = width;
        const heightStart = height;
           
        const bounce = Moves.bounce(yStart - strength, yStart, {
            xStart, widthStart, heightStart, bFactor, cFactor 
        });
        
        const ys = bounce.height.list.map(height => {
            return yStart - (height - heightStart) / 2;
        });

        return {
            y: { list: ys },
            x: bounce.x, 
            width: bounce.width, 
            height: bounce.height
        };
    }
    
    static spiral({
            startAngle = 0,
            endAngle = 360,
            angleStep = 18,
            x = 0,
            y = 0,
            width = 100,
            height = 100
        } = {}) 
    {
        const xCoords = [], yCoords = [], rotations = [];

        for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
            const radians = angle * (Math.PI / 180);
            xCoords.push(Math.floor(x + width * Math.cos(radians)));
            yCoords.push(Math.floor(y + height * Math.sin(radians)));
            rotations.push(90 + angle);
        }

        return {
            x: { list: xCoords },
            y: { list: yCoords },
            rotate: { list: rotations }
        };
    }
}

export { Moves };
